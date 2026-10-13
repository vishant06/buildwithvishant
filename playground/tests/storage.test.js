import assert from "node:assert/strict";
import { test } from "node:test";
import { GUEST, LEGACY_PRIVATE_KEYS, QUARANTINE_KEY, createScopedStore, namespaceFor, quarantineLegacyStorage } from "../src/workspace/storage.js";

const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
};

const jwt = (claims) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.sig`;
};
const A = "a".repeat(24);
const B = "b".repeat(24);
const future = Math.floor(Date.now() / 1000) + 3600;

test("namespaceFor: no token, garbage, bad id or expired token is the guest namespace", () => {
  assert.equal(namespaceFor(null), GUEST);
  assert.equal(namespaceFor("not-a-jwt"), GUEST);
  assert.equal(namespaceFor(jwt({ id: "../../etc", exp: future })), GUEST);
  assert.equal(namespaceFor(jwt({ id: A, exp: Math.floor(Date.now() / 1000) - 10 })), GUEST);
  assert.equal(namespaceFor(jwt({ exp: future })), GUEST);
});

test("namespaceFor: each account gets its own namespace", () => {
  assert.equal(namespaceFor(jwt({ id: A, exp: future })), `u_${A}`);
  assert.notEqual(namespaceFor(jwt({ id: A, exp: future })), namespaceFor(jwt({ id: B, exp: future })));
});

test("Test E/F: accounts sharing one browser never see each other's drafts, and each gets its own back", () => {
  const backend = memory();
  const a = createScopedStore(`u_${A}`, backend);
  const b = createScopedStore(`u_${B}`, backend);
  const guest = createScopedStore(GUEST, memory());

  a.setJson("playground_workspace_v2", { nodes: ["secret.java"] });
  assert.equal(b.getJson("playground_workspace_v2"), null);
  assert.equal(guest.getJson("playground_workspace_v2"), null);

  b.setJson("playground_workspace_v2", { nodes: ["b.py"] });
  assert.deepEqual(a.getJson("playground_workspace_v2"), { nodes: ["secret.java"] });
  assert.deepEqual(b.getJson("playground_workspace_v2"), { nodes: ["b.py"] });

  // "log back in as A": a fresh store for the same namespace reads A's draft
  assert.deepEqual(createScopedStore(`u_${A}`, backend).getJson("playground_workspace_v2"), { nodes: ["secret.java"] });
});

test("guest namespace uses its own backend and never touches account storage", () => {
  const local = memory();
  const session = memory();
  createScopedStore(`u_${A}`, local).setText("playground_stdin", "private");
  createScopedStore(GUEST, session).setText("playground_stdin", "guest");
  assert.equal([...session.data.keys()].some((k) => k.includes(A)), false);
  assert.equal(createScopedStore(GUEST, session).getText("playground_stdin"), "guest");
});

test("Test I (browser): legacy shared keys are quarantined, not shown, not deleted, never overwritten", () => {
  const backend = memory();
  for (const key of LEGACY_PRIVATE_KEYS) backend.setItem(key, JSON.stringify({ key }));
  backend.setItem("playground_font_size", "16");

  assert.equal(quarantineLegacyStorage(backend), LEGACY_PRIVATE_KEYS.length);
  for (const key of LEGACY_PRIVATE_KEYS) assert.equal(backend.getItem(key), null);
  assert.equal(backend.getItem("playground_font_size"), "16");

  const kept = JSON.parse(backend.getItem(QUARANTINE_KEY));
  assert.deepEqual(Object.keys(kept).sort(), [...LEGACY_PRIVATE_KEYS].sort());

  // scoped stores cannot see quarantined data
  assert.equal(createScopedStore(`u_${A}`, backend).getJson("playground_workspace_v2"), null);

  // running again changes nothing
  assert.equal(quarantineLegacyStorage(backend), 0);
  assert.deepEqual(JSON.parse(backend.getItem(QUARANTINE_KEY)), kept);
});
