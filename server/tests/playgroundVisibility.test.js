// Privacy tests (Feature 1/2). Run with:  npm test   (Node 22+, no database needed)
//
// Same approach as playgroundIsolation.test.js: the Mongoose model is replaced by
// an in-memory store that applies the exact filter the controller passes, so
// these tests prove the controllers always query by owner / slug + 'public'.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, mock, test } from 'node:test';

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);
const userA = { _id: A, role: 'user' };
const userB = { _id: B, role: 'user' };
const admin = { _id: 'c'.repeat(24), role: 'admin' };

let rows = [];
let nextId = 1;
const matches = (row, filter) => Object.entries(filter).every(([k, v]) => String(row[k]) === String(v));
const wrap = (row) => ({
  ...row,
  async save() {
    row.updatedAt = row.updatedAt; // timestamps: false -> untouched
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
    // mirrors the schema default: new projects are private
    const row = { _id: String(nextId++).padStart(24, '0'), files: undefined, visibility: 'private', createdAt: new Date(), updatedAt: new Date('2026-01-01'), ...doc };
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
let pub;
before(async () => {
  mock.module('mongoose', { defaultExport: { isValidObjectId: (id) => /^[a-f0-9]{24}$/i.test(String(id)) }, namedExports: {} });
  mock.module(new URL('../src/models/PlaygroundProject.js', import.meta.url).href, { defaultExport: FakeModel });
  ctrl = await import('../src/controllers/playgroundController.js');
  pub = await import('../src/controllers/playgroundPublicController.js');
});

const call = async (handler, user, { params = {}, body = {}, query = {} } = {}) => {
  const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ user, params, body, query }, res);
  return res;
};
const reset = () => { rows = []; nextId = 1; };
const seed = async (user = userA, extra = {}) =>
  (await call(ctrl.create, user, {
    body: {
      title: 'Showcase', language: 'javascript', entryFile: 'src/main.js',
      files: [
        { id: 'f1', path: 'src/main.js', type: 'file', content: 'console.log("hi")' },
        { id: 'f2', path: '.env', type: 'file', content: 'DB_PASSWORD=hunter2' },
        { id: 'f3', path: 'src/key.pem', type: 'file', content: 'x' },
        { id: 'f4', path: 'notes.txt', type: 'file', content: '-----BEGIN RSA PRIVATE KEY-----\nabc' },
        { id: 'f5', path: 'README.md', type: 'file', content: '# hello' },
        { id: 'f6', path: '.env.example', type: 'file', content: 'DB_PASSWORD=' }
      ],
      ...extra
    }
  })).body;
const publish = async (project, user = userA) => (await call(ctrl.setVisibility, user, { params: { id: project._id }, body: { visibility: 'public' } })).body;
const view = (slug, user) => call(pub.getPublic, user, { params: { slug } });

test('1. a new project is private by default and has no public link', async () => {
  reset();
  const project = await seed();
  assert.equal(project.visibility, 'private');
  assert.equal(project.publicSlug, undefined);
  assert.equal(rows[0].visibility, 'private');
});

test('2. anonymous visitors get nothing for a private project, any slug-shaped guess, or malformed input', async () => {
  reset();
  const project = await seed();
  for (const slug of ['A'.repeat(12), String(project._id), 'short', '../etc/passwd', '', undefined, { $ne: null }, ['x']]) {
    const res = await view(slug);
    assert.equal(res.statusCode, 404, `slug ${JSON.stringify(slug)}`);
    assert.deepEqual(res.body, { message: 'This project is private or no longer available.' });
  }
});

test('3. a project row with visibility missing / null / unknown is never served, even with a slug', async () => {
  reset();
  for (const visibility of [undefined, null, '', 'PUBLIC', 'public ', 'shared', true, 1]) {
    rows.push({ _id: String(nextId++).padStart(24, '0'), title: 'x', language: 'python', code: 'print(1)', owner: A, publicSlug: 'SlugSlug1234', visibility, createdAt: new Date(), updatedAt: new Date() });
    assert.equal((await view('SlugSlug1234')).statusCode, 404, `visibility ${String(visibility)}`);
    rows.pop();
  }
});

test('4. only the owner can change visibility; others (and admins) get the same 404 as for a missing project', async () => {
  reset();
  const project = await seed();
  for (const user of [userB, admin]) {
    for (const visibility of ['public', 'private']) {
      const res = await call(ctrl.setVisibility, user, { params: { id: project._id }, body: { visibility } });
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.body, { message: 'Playground project not found' });
    }
  }
  assert.equal(rows[0].visibility, 'private');
  assert.equal(rows[0].publicSlug, undefined);
});

test('5. visibility input is validated (only "public" / "private")', async () => {
  reset();
  const project = await seed();
  for (const visibility of [undefined, '', 'Public', 'friends', true, { $set: 1 }, ['public']]) {
    const res = await call(ctrl.setVisibility, userA, { params: { id: project._id }, body: { visibility } });
    assert.equal(res.statusCode, 400);
  }
  assert.equal(rows[0].visibility, 'private');
});

test('6. clients cannot make a project public through create / update (mass assignment)', async () => {
  reset();
  const created = await call(ctrl.create, userA, { body: { title: 'x', language: 'python', code: '1', visibility: 'public', publicSlug: 'HackedSlug12', publishedAt: new Date() } });
  assert.equal(created.statusCode, 201);
  assert.equal(rows[0].visibility, 'private');
  assert.equal(rows[0].publicSlug, undefined);
  const updated = await call(ctrl.update, userA, { params: { id: created.body._id }, body: { title: 'y', visibility: 'public', publicSlug: 'HackedSlug12' } });
  assert.equal(updated.statusCode, 200);
  assert.equal(rows[0].visibility, 'private');
  assert.equal(rows[0].publicSlug, undefined);
  assert.equal((await view('HackedSlug12')).statusCode, 404);
});

test('7. publishing creates a random link; the public view is read-only data without owner details', async () => {
  reset();
  const project = await seed();
  const shared = await publish(project);
  assert.equal(shared.visibility, 'public');
  assert.match(shared.publicSlug, /^[A-Za-z0-9_-]{12}$/);
  assert.notEqual(shared.publicSlug, project._id);

  const res = await view(shared.publicSlug); // anonymous
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.readOnly, true);
  assert.equal(res.body.title, 'Showcase');
  assert.equal(res.body.isOwner, false);
  const text = JSON.stringify(res.body);
  for (const forbidden of [A, project._id, 'owner', 'createdAt', 'userId']) assert.equal(text.includes(forbidden), false, `leaked ${forbidden}`);
  assert.equal('projectId' in res.body, false);
});

test('8. public view hides .env, key files and private-key content, but keeps .env.example', async () => {
  reset();
  const project = await seed();
  const shared = await publish(project);
  const body = (await view(shared.publicSlug)).body;
  const paths = body.workspace.files.map((file) => file.path).sort();
  assert.deepEqual(paths, ['.env.example', 'README.md', 'src', 'src/main.js']);
  assert.equal(body.hiddenFileCount, 3);
  assert.equal(JSON.stringify(body).includes('hunter2'), false);
  assert.equal(JSON.stringify(body).includes('PRIVATE KEY'), false);
  assert.equal(body.workspace.entryFile, 'src/main.js');
});

test('9. a hidden entry file is not advertised as the entry file', async () => {
  reset();
  const project = await seed(userA, { entryFile: '.env' });
  const shared = await publish(project);
  assert.equal((await view(shared.publicSlug)).body.workspace.entryFile, '');
});

test('10. switching back to private revokes access immediately and kills the old link for good', async () => {
  reset();
  const project = await seed();
  const first = await publish(project);
  assert.equal((await view(first.publicSlug)).statusCode, 200);

  const off = await call(ctrl.setVisibility, userA, { params: { id: project._id }, body: { visibility: 'private' } });
  assert.equal(off.body.visibility, 'private');
  assert.equal(off.body.publicSlug, null);
  assert.equal((await view(first.publicSlug)).statusCode, 404);
  assert.equal(rows[0].publicSlug, undefined);

  // re-publishing gives a NEW link; the stale one stays dead
  const second = await publish(project);
  assert.notEqual(second.publicSlug, first.publicSlug);
  assert.equal((await view(first.publicSlug)).statusCode, 404);
  assert.equal((await view(second.publicSlug)).statusCode, 200);
});

test('11. publishing twice keeps the link; regenerate swaps it and invalidates the old one', async () => {
  reset();
  const project = await seed();
  const first = await publish(project);
  const again = await publish(project);
  assert.equal(again.publicSlug, first.publicSlug);
  const rotated = (await call(ctrl.setVisibility, userA, { params: { id: project._id }, body: { visibility: 'public', regenerate: true } })).body;
  assert.notEqual(rotated.publicSlug, first.publicSlug);
  assert.equal((await view(first.publicSlug)).statusCode, 404);
  assert.equal((await view(rotated.publicSlug)).statusCode, 200);
});

test('12. deleting a public project makes its link 404', async () => {
  reset();
  const project = await seed();
  const shared = await publish(project);
  await call(ctrl.remove, userA, { params: { id: project._id } });
  assert.equal((await view(shared.publicSlug)).statusCode, 404);
});

test('13. visitors cannot modify a public project (public routes are GET-only; edits still need the owner)', async () => {
  reset();
  const project = await seed();
  const shared = await publish(project);
  for (const user of [userB, admin]) {
    for (const [handler, extra] of [[ctrl.update, { body: { title: 'pwned', code: 'x' } }], [ctrl.remove, {}], [ctrl.getOne, {}]]) {
      const res = await call(handler, user, { params: { id: project._id }, ...extra });
      assert.equal(res.statusCode, 404);
    }
  }
  assert.equal(rows[0].title, 'Showcase');
  assert.equal(rows.length, 1);
  assert.equal((await view(shared.publicSlug)).statusCode, 200);
  const routes = readFileSync(new URL('../src/routes/playgroundPublicRoutes.js', import.meta.url), 'utf8');
  assert.deepEqual([...routes.matchAll(/router\.(get|post|put|patch|delete|all)\(/g)].map((m) => m[1]), ['get']);
});

test('14. the owner gets isOwner + projectId (for "Open in editor"); other signed-in users do not', async () => {
  reset();
  const project = await seed();
  const shared = await publish(project);
  const asOwner = (await view(shared.publicSlug, userA)).body;
  assert.equal(asOwner.isOwner, true);
  assert.equal(asOwner.projectId, project._id);
  const asOther = (await view(shared.publicSlug, userB)).body;
  assert.equal(asOther.isOwner, false);
  assert.equal('projectId' in asOther, false);
});

test('15. changing visibility does not bump updatedAt (no false editor conflicts) and keeps files', async () => {
  reset();
  const project = await seed();
  const before = rows[0].updatedAt;
  await publish(project);
  assert.equal(rows[0].updatedAt, before);
  assert.equal(rows[0].files.length, 7); // 6 files + the implicit "src" folder
  assert.equal(rows[0].owner, A);
});

test('16. legacy single-file projects (no workspace yet) are shown, with the owner id never exposed', async () => {
  reset();
  rows.push({ _id: '7'.repeat(24), title: 'Old', language: 'python', code: 'print("old")', owner: A, visibility: 'public', publicSlug: 'LegacySlug99', createdAt: new Date(), updatedAt: new Date() });
  const res = await view('LegacySlug99');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.workspace.files[0].content, 'print("old")');
  assert.equal(JSON.stringify(res.body).includes(A), false);
});

test('17. wiring: the public router is mounted before the private one, is rate limited, never cached; PATCH sits behind protect', () => {
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.ok(server.indexOf("'/api/playground/public'") > 0);
  assert.ok(server.indexOf("'/api/playground/public'") < server.indexOf("app.use('/api/playground', playgroundRoutes)"));
  const publicRoutes = readFileSync(new URL('../src/routes/playgroundPublicRoutes.js', import.meta.url), 'utf8');
  assert.match(publicRoutes, /no-store/);
  assert.match(publicRoutes, /rateLimit/);
  assert.match(publicRoutes, /noindex/);
  const priv = readFileSync(new URL('../src/routes/playgroundRoutes.js', import.meta.url), 'utf8');
  assert.ok(priv.indexOf("router.patch('/:id/visibility'") > priv.indexOf('router.use(protect)'));
  const model = readFileSync(new URL('../src/models/PlaygroundProject.js', import.meta.url), 'utf8');
  assert.match(model, /visibility: \{ type: String, enum: \['private', 'public'\], default: 'private'/);
});
