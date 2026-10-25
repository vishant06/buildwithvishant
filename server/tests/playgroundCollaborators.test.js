// Sharing with specific people (viewer / editor / full access). No database needed.
import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';

const id = (c) => c.repeat(24);
const OWNER = { _id: id('a'), role: 'user' };
const BOB = { _id: id('b'), role: 'user' };
const CARA = { _id: id('c'), role: 'user' };
const DAN = { _id: id('d'), role: 'user' };
const STRANGER = { _id: id('e'), role: 'user' };
const users = [
  { ...OWNER, username: 'owner', email: 'owner@x.com', name: 'Owner' }, { ...BOB, username: 'bob', email: 'bob@x.com', name: 'Bob' },
  { ...CARA, username: 'cara', email: 'cara@x.com', name: 'Cara' }, { ...DAN, username: 'dan', email: 'dan@x.com', name: 'Dan' }, { ...STRANGER, username: 'eve', email: 'eve@x.com', name: 'Eve' }
];

let rows = [];
const get = (row, path) => {
  const [head, ...rest] = path.split('.');
  const value = row[head];
  if (!rest.length) return [value];
  return (Array.isArray(value) ? value : [value]).flatMap((item) => (item ? get(item, rest.join('.')) : []));
};
const matches = (row, filter) => Object.entries(filter).every(([k, v]) => (v && typeof v === 'object' && '$in' in v ? get(row, k).some((x) => v.$in.map(String).includes(String(x))) : get(row, k).some((x) => String(x) === String(v))));
const wrap = (row) => ({
  ...row,
  async save() { Object.assign(row, Object.fromEntries(Object.entries(this).filter(([k]) => typeof this[k] !== 'function'))); return wrap(row); },
  toObject() { return JSON.parse(JSON.stringify(row)); }
});
const Project = {
  find(filter) {
    const out = rows.filter((r) => matches(r, filter));
    let excluded = [];
    const c = { select: (s) => { excluded = String(s).split(' ').filter((x) => x.startsWith('-')).map((x) => x.slice(1)); return c; }, sort: () => c, then: (a, b) => Promise.resolve(out.map((r) => wrap(Object.fromEntries(Object.entries(r).filter(([k]) => !excluded.includes(k)))))).then(a, b) };
    return c;
  },
  async findOne(filter) { const row = rows.find((r) => matches(r, filter)); return row ? wrap(row) : null; },
  async create(doc) { const row = { _id: id('1'), visibility: 'private', createdAt: new Date(), updatedAt: new Date('2026-01-01'), ...doc }; rows.push(row); return wrap(row); },
  async deleteOne(filter) { rows = rows.filter((r) => !matches(r, filter)); return {}; }
};
const User = {
  findOne(filter) { const [[k, v]] = Object.entries(filter); const u = users.find((x) => x[k] === v); const c = { select: () => c, then: (a, b) => Promise.resolve(u ? { ...u } : null).then(a, b) }; return c; },
  find(filter) { const ids = filter._id.$in.map(String); const out = users.filter((u) => ids.includes(String(u._id))); const c = { select: () => c, then: (a, b) => Promise.resolve(out).then(a, b) }; return c; }
};

let P; let M;
before(async () => {
  mock.module('mongoose', { defaultExport: { isValidObjectId: (v) => /^[a-f0-9]{24}$/i.test(String(v)) }, namedExports: {} });
  mock.module(new URL('../src/models/PlaygroundProject.js', import.meta.url).href, { defaultExport: Project });
  mock.module(new URL('../src/models/User.js', import.meta.url).href, { defaultExport: User });
  P = await import('../src/controllers/playgroundController.js');
  M = await import('../src/controllers/playgroundMembersController.js');
});

const call = async (handler, user, { params = {}, body = {} } = {}) => {
  const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ user, params, body, query: {} }, res);
  return res;
};
const setup = async () => {
  rows = [];
  const created = await call(P.create, OWNER, { body: { title: 'Team', language: 'python', code: 'print(1)' } });
  return created.body._id;
};
const add = (pid, actor, identifier, role) => call(M.addMember, actor, { params: { id: pid }, body: { identifier, role } });
const save = (pid, user, title = 'edited') => call(P.update, user, { params: { id: pid }, body: { title, code: 'print(2)' } });

test('1. nobody has access until the owner adds them; a stranger gets the plain 404', async () => {
  const pid = await setup();
  for (const handler of [P.getOne, P.update, P.remove, P.setVisibility]) assert.equal((await call(handler, BOB, { params: { id: pid }, body: { visibility: 'public' } })).statusCode, 404);
  assert.deepEqual((await call(P.shared, BOB)).body, []);
});

test('2. viewer: can open, cannot save, cannot delete, cannot share; sees no owner id or privacy fields', async () => {
  const pid = await setup();
  assert.equal((await add(pid, OWNER, 'bob', 'viewer')).statusCode, 201);
  const open = await call(P.getOne, BOB, { params: { id: pid } });
  assert.equal(open.statusCode, 200);
  assert.equal(open.body.myRole, 'viewer');
  for (const key of ['owner', 'collaborators', 'visibility', 'publicSlug']) assert.equal(key in open.body, false, key);
  assert.equal((await save(pid, BOB)).statusCode, 403);
  assert.equal(rows[0].title, 'Team');
  assert.equal((await call(P.remove, BOB, { params: { id: pid } })).statusCode, 404);
  assert.equal((await call(P.setVisibility, BOB, { params: { id: pid }, body: { visibility: 'public' } })).statusCode, 403);
  assert.equal((await call(M.listMembers, BOB, { params: { id: pid } })).statusCode, 403);
  assert.equal((await add(pid, BOB, 'cara', 'viewer')).statusCode, 403);
});

test('3. editor: can save (owner stays the owner), cannot delete, share or manage people', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob@x.com', 'editor');
  const saved = await save(pid, BOB, 'by bob');
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.myRole, 'editor');
  assert.equal(rows[0].title, 'by bob');
  assert.equal(rows[0].owner, OWNER._id);
  assert.equal(rows[0].collaborators.length, 1);
  assert.equal((await call(P.remove, BOB, { params: { id: pid } })).statusCode, 404);
  assert.equal(rows.length, 1);
  assert.equal((await call(P.setVisibility, BOB, { params: { id: pid }, body: { visibility: 'public' } })).statusCode, 403);
  assert.equal((await add(pid, BOB, 'cara', 'viewer')).statusCode, 403);
});

test('4. editors cannot give themselves more access, even by sending extra fields', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'editor');
  await call(P.update, BOB, { params: { id: pid }, body: { title: 'x', owner: BOB._id, visibility: 'public', collaborators: [{ user: BOB._id, role: 'manager' }] } });
  assert.equal(rows[0].owner, OWNER._id);
  assert.equal(rows[0].visibility, 'private');
  assert.equal(rows[0].collaborators[0].role, 'editor');
});

test('5. full access (manager): can edit, share, and manage viewers/editors, but not delete, not grant full access, not touch managers', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'manager');
  assert.equal((await save(pid, BOB)).statusCode, 200);
  const pub = await call(P.setVisibility, BOB, { params: { id: pid }, body: { visibility: 'public' } });
  assert.equal(pub.statusCode, 200);
  assert.match(pub.body.publicSlug, /^[A-Za-z0-9_-]{12}$/);
  assert.equal((await call(P.getOne, BOB, { params: { id: pid } })).body.visibility, 'public');
  assert.equal((await add(pid, BOB, 'cara', 'editor')).statusCode, 201);
  assert.equal((await add(pid, BOB, 'dan', 'manager')).statusCode, 403);
  assert.equal((await call(M.setMemberRole, BOB, { params: { id: pid, userId: CARA._id }, body: { role: 'manager' } })).statusCode, 403);
  assert.equal((await call(M.setMemberRole, BOB, { params: { id: pid, userId: CARA._id }, body: { role: 'viewer' } })).statusCode, 200);
  assert.equal((await call(M.removeMember, BOB, { params: { id: pid, userId: CARA._id } })).statusCode, 200);
  assert.equal((await call(P.remove, BOB, { params: { id: pid } })).statusCode, 404);
  assert.equal(rows.length, 1);
  // owner makes a second manager; the first cannot demote or remove them
  await add(pid, OWNER, 'dan', 'manager');
  assert.equal((await call(M.setMemberRole, BOB, { params: { id: pid, userId: DAN._id }, body: { role: 'viewer' } })).statusCode, 403);
  assert.equal((await call(M.removeMember, BOB, { params: { id: pid, userId: DAN._id } })).statusCode, 403);
  assert.equal((await call(M.removeMember, OWNER, { params: { id: pid, userId: DAN._id } })).statusCode, 200);
});

test('6. the owner can never be added, removed or demoted by anyone; nobody adds themselves', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'manager');
  assert.equal((await add(pid, BOB, 'owner', 'viewer')).statusCode, 400);
  assert.equal((await add(pid, OWNER, 'owner', 'viewer')).statusCode, 400);
  assert.equal((await add(pid, BOB, 'bob', 'viewer')).statusCode, 400);
  assert.equal((await call(M.removeMember, BOB, { params: { id: pid, userId: OWNER._id } })).statusCode, 404);
  assert.equal(rows[0].owner, OWNER._id);
});

test('7. changes apply immediately: demote, then remove, and the very next request is refused', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'editor');
  assert.equal((await save(pid, BOB)).statusCode, 200);
  await call(M.setMemberRole, OWNER, { params: { id: pid, userId: BOB._id }, body: { role: 'viewer' } });
  assert.equal((await save(pid, BOB)).statusCode, 403);
  assert.equal((await call(P.getOne, BOB, { params: { id: pid } })).statusCode, 200);
  await call(M.removeMember, OWNER, { params: { id: pid, userId: BOB._id } });
  assert.equal((await call(P.getOne, BOB, { params: { id: pid } })).statusCode, 404);
  assert.deepEqual((await call(P.shared, BOB)).body, []);
});

test('8. "shared with me" lists only my projects, with my role, and no owner / member data', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'editor');
  const list = (await call(P.shared, BOB)).body;
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ['_id', 'language', 'myRole', 'title', 'updatedAt']);
  assert.equal(list[0].myRole, 'editor');
  assert.deepEqual((await call(P.shared, CARA)).body, []);
  assert.equal(JSON.stringify((await call(P.mine, OWNER)).body).includes('collaborators'), false);
});

test('9. members list shows usernames only (no emails or ids of other accounts beyond the member id)', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'viewer');
  const res = await call(M.listMembers, OWNER, { params: { id: pid } });
  assert.equal(res.body.members[0].username, 'bob');
  assert.equal(JSON.stringify(res.body).includes('@x.com'), false);
});

test('10. input is validated: unknown user, bad role, objects instead of strings, duplicates, the 20-person cap', async () => {
  const pid = await setup();
  assert.equal((await add(pid, OWNER, 'nobody', 'viewer')).statusCode, 404);
  assert.equal((await add(pid, OWNER, 'bob', 'owner')).statusCode, 400);
  assert.equal((await add(pid, OWNER, { $ne: '' }, 'viewer')).statusCode, 400);
  assert.equal((await add(pid, OWNER, '', 'viewer')).statusCode, 400);
  assert.equal((await add(pid, OWNER, 'bob', 'viewer')).statusCode, 201);
  assert.equal((await add(pid, OWNER, 'bob', 'editor')).statusCode, 409);
  rows[0].collaborators = Array.from({ length: 20 }, (_, i) => ({ user: String(i).padStart(24, '9'), role: 'viewer' }));
  assert.equal((await add(pid, OWNER, 'cara', 'viewer')).statusCode, 400);
});

test('11. a collaborator can leave; the owner cannot; adding/leaving never bumps updatedAt', async () => {
  const pid = await setup();
  const before = rows[0].updatedAt;
  await add(pid, OWNER, 'bob', 'editor');
  assert.equal(rows[0].updatedAt, before);
  assert.equal((await call(M.leaveProject, OWNER, { params: { id: pid } })).statusCode, 400);
  assert.equal((await call(M.leaveProject, BOB, { params: { id: pid } })).statusCode, 200);
  assert.equal((await call(P.getOne, BOB, { params: { id: pid } })).statusCode, 404);
  assert.equal((await call(M.leaveProject, STRANGER, { params: { id: pid } })).statusCode, 404);
});

test('12. collaborators also get "open in editor" on the public page, strangers do not', async () => {
  const pid = await setup();
  await add(pid, OWNER, 'bob', 'viewer');
  await call(P.setVisibility, OWNER, { params: { id: pid }, body: { visibility: 'public' } });
  const { getPublic } = await import('../src/controllers/playgroundPublicController.js');
  const slug = rows[0].publicSlug;
  assert.equal((await call(getPublic, BOB, { params: { slug } })).body.projectId, pid);
  assert.equal('projectId' in (await call(getPublic, STRANGER, { params: { slug } })).body, false);
  assert.equal(JSON.stringify((await call(getPublic, BOB, { params: { slug } })).body).includes('collaborators'), false);
});
