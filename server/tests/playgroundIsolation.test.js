// Controller-level isolation tests. Run with:  npm test   (Node 22+, no database needed)
//
// The Mongoose model is replaced by an in-memory store that applies the exact
// filter object the controller passes (equality on every key), so these tests
// prove the controller always constrains queries by the authenticated owner.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, mock, test } from 'node:test';

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);
const ADMIN = 'c'.repeat(24);
const userA = { _id: A, role: 'user' };
const userB = { _id: B, role: 'user' };
const admin = { _id: ADMIN, role: 'admin' };

let rows = [];
let nextId = 1;
const matches = (row, filter) => Object.entries(filter).every(([k, v]) => String(row[k]) === String(v));
const wrap = (row) => ({
  ...row,
  async save() {
    row.updatedAt = new Date(Date.now() + 1);
    Object.assign(row, Object.fromEntries(Object.entries(this).filter(([k]) => typeof this[k] !== 'function')));
    return wrap(row);
  },
  toObject() { return { ...row }; }
});
const FakeModel = {
  find(filter) {
    const out = rows.filter((row) => matches(row, filter));
    const chain = { select: () => chain, sort: () => chain, then: (res, rej) => Promise.resolve(out.map((r) => ({ ...r }))).then(res, rej) };
    return chain;
  },
  async findOne(filter) {
    const row = rows.find((r) => matches(r, filter));
    return row ? wrap(row) : null;
  },
  async create(doc) {
    const row = { _id: String(nextId++).padStart(24, '0'), files: undefined, createdAt: new Date(), updatedAt: new Date(), ...doc };
    rows.push(row);
    return wrap(row);
  },
  async deleteOne(filter) {
    const index = rows.findIndex((r) => matches(r, filter));
    if (index >= 0) rows.splice(index, 1);
    return { deletedCount: index >= 0 ? 1 : 0 };
  }
};

let ctrl;
before(async () => {
  mock.module('mongoose', { defaultExport: { isValidObjectId: (id) => /^[a-f0-9]{24}$/i.test(String(id)) }, namedExports: {} });
  mock.module(new URL('../src/models/PlaygroundProject.js', import.meta.url).href, { defaultExport: FakeModel });
  ctrl = await import('../src/controllers/playgroundController.js');
});

const call = async (handler, user, { params = {}, body = {}, query = {} } = {}) => {
  const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ user, params, body, query }, res);
  return res;
};
const reset = () => { rows = []; nextId = 1; };
const seedA = async () => (await call(ctrl.create, userA, { body: { title: 'DSA', language: 'java', files: [{ id: 'f1', path: 'secret.java', type: 'file', content: 'class Secret {}' }], entryFile: 'secret.java' } })).body;

test('Test B: owner can create, list, load and modify their own project', async () => {
  reset();
  const project = await seedA();
  assert.ok(project._id);
  assert.equal(String((await call(ctrl.mine, userA)).body.length), '1');
  assert.equal((await call(ctrl.getOne, userA, { params: { id: project._id } })).statusCode, 200);
  const updated = await call(ctrl.update, userA, { params: { id: project._id }, body: { title: 'DSA 2' } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.title, 'DSA 2');
});

test('Test C: another user cannot list, read, edit or delete it, even with the exact id', async () => {
  reset();
  const project = await seedA();
  assert.deepEqual((await call(ctrl.mine, userB)).body, []);
  for (const [name, handler, extra] of [['read', ctrl.getOne, {}], ['edit', ctrl.update, { body: { title: 'pwned', code: 'x' } }], ['delete', ctrl.remove, {}]]) {
    const res = await call(handler, userB, { params: { id: project._id }, ...extra });
    assert.equal(res.statusCode, 404, `${name} must be 404`);
    assert.deepEqual(res.body, { message: 'Playground project not found' }, `${name} must not reveal anything`);
  }
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'DSA');
});

test('Test C/D: admins get no access to other users\' saved code', async () => {
  reset();
  const project = await seedA();
  for (const handler of [ctrl.getOne, ctrl.update, ctrl.remove]) {
    assert.equal((await call(handler, admin, { params: { id: project._id }, body: { title: 'x' } })).statusCode, 404);
  }
  assert.equal(rows.length, 1);
});

test('Test D: owner/user ids supplied by the client are ignored', async () => {
  reset();
  const created = await call(ctrl.create, userB, { body: { title: 'mine', language: 'python', code: 'print(1)', owner: A, ownerId: A, userId: A }, query: { owner: A } });
  assert.equal(String(rows[0].owner), B);
  assert.equal(created.statusCode, 201);
  const project = await seedA();
  const hijack = await call(ctrl.update, userA, { params: { id: project._id }, body: { title: 't', owner: B } });
  assert.equal(String(rows.find((r) => r._id === project._id).owner), A);
  assert.equal(hijack.statusCode, 200);
  // malformed / injected ids are rejected the same way as unknown ones
  for (const id of ['not-an-id', '{"$ne":null}', '../x']) {
    assert.equal((await call(ctrl.getOne, userA, { params: { id } })).statusCode, 404);
  }
  assert.equal((await call(ctrl.getOne, userA, { params: { id: { $ne: null } } })).statusCode, 404);
});

test('Test I: records without a valid owner are never returned', async () => {
  reset();
  rows.push({ _id: '9'.repeat(24), title: 'legacy', language: 'python', code: 'x', createdAt: new Date(), updatedAt: new Date() });
  assert.deepEqual((await call(ctrl.mine, userA)).body, []);
  assert.equal((await call(ctrl.getOne, userA, { params: { id: '9'.repeat(24) } })).statusCode, 404);
  assert.equal((await call(ctrl.getOne, admin, { params: { id: '9'.repeat(24) } })).statusCode, 404);
});

test('Test A/H (wiring): every saved-project route sits behind `protect`; execute takes inline files only', () => {
  const routes = readFileSync(new URL('../src/routes/playgroundRoutes.js', import.meta.url), 'utf8');
  const protectAt = routes.indexOf('router.use(protect)');
  assert.ok(protectAt > 0, 'router.use(protect) missing');
  for (const line of routes.split('\n').filter((l) => /router\.(get|post|put|delete)\(/.test(l) && !l.includes("'/execute'"))) {
    assert.ok(routes.indexOf(line) > protectAt, `route registered before protect: ${line.trim()}`);
  }
  assert.match(routes, /private, no-store/);
  const exec = readFileSync(new URL('../src/controllers/executionController.js', import.meta.url), 'utf8');
  assert.equal(/PlaygroundProject|projectId|workspaceId/.test(exec), false, 'execution must not resolve saved projects');
});
