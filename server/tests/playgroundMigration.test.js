// Visibility migration (Feature 1, point 6). No database needed: the Model is a tiny
// in-memory implementation of the three Mongo operations the migration uses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyVisibilityMigration, planVisibilityMigration } from '../src/migrations/playgroundVisibility.js';

const has = (row, key) => Object.prototype.hasOwnProperty.call(row, key);
const match = (row, f) => {
  if (f.$or) return f.$or.some((alt) => match(row, alt)) && match(row, { ...f, $or: undefined });
  return Object.entries(f).every(([key, cond]) => {
    if (key === '$or' || cond === undefined) return true;
    if (cond && typeof cond === 'object') {
      if ('$nin' in cond) return !cond.$nin.includes(row[key]);
      if ('$ne' in cond) return row[key] !== cond.$ne;
      if ('$exists' in cond) return has(row, key) === cond.$exists;
    }
    return row[key] === cond;
  });
};
const makeModel = (rows) => ({
  async countDocuments(f) { return rows.filter((r) => match(r, f)).length; },
  async updateMany(f, update) {
    let n = 0;
    for (const row of rows.filter((r) => match(r, f))) {
      Object.assign(row, update.$set || {});
      for (const key of Object.keys(update.$unset || {})) delete row[key];
      n += 1;
    }
    return { modifiedCount: n };
  }
});

const files = [{ id: '1', path: 'a.py', type: 'file', content: 'print(1)' }];

test('missing / null / invalid visibility becomes private; files, owners and titles are untouched', async () => {
  const rows = [
    { _id: 1, owner: 'u1', title: 'old', files },
    { _id: 2, owner: 'u1', title: 'null', visibility: null, files },
    { _id: 3, owner: 'u2', title: 'junk', visibility: 'everyone', files },
    { _id: 4, owner: 'u2', title: 'ok-private', visibility: 'private', files },
    { _id: 5, owner: 'u3', title: 'ok-public', visibility: 'public', publicSlug: 'AbCdEfGh1234', files }
  ];
  const snapshot = JSON.stringify(rows.map(({ visibility, ...rest }) => rest));
  const model = makeModel(rows);
  assert.equal((await planVisibilityMigration(model)).missing, 3);
  const result = await applyVisibilityMigration(model);
  assert.equal(result.madePrivate, 3);
  assert.deepEqual(rows.map((r) => r.visibility), ['private', 'private', 'private', 'private', 'public']);
  assert.equal(JSON.stringify(rows.map(({ visibility, ...rest }) => rest)), snapshot);
  assert.equal(rows[4].publicSlug, 'AbCdEfGh1234'); // a real public project keeps its link
});

test('nothing is ever made public, stray links are removed, linkless "public" becomes private, re-running is a no-op', async () => {
  const rows = [
    { _id: 1, visibility: 'private', publicSlug: 'StaleSlug123', publishedAt: new Date(), files },
    { _id: 2, visibility: 'public', files }, // corrupt: public with no link
    { _id: 3, visibility: 'public', publicSlug: null, files },
    { _id: 4, files } // no visibility at all
  ];
  const model = makeModel(rows);
  await applyVisibilityMigration(model);
  assert.equal(rows.some((r) => r.visibility === 'public'), false);
  assert.equal(rows.some((r) => has(r, 'publicSlug') || has(r, 'publishedAt')), false);
  assert.deepEqual(await applyVisibilityMigration(model), { madePrivate: 0, linksRemoved: 0 });
  assert.deepEqual(await planVisibilityMigration(model), { missing: 0, strayLinks: 0, publicNoSlug: 0 });
});
