// Local-folder sync tests: the real LocalFolder adapter + SyncController + the real
// workspace state functions, against an in-memory folder. Covers every scenario in
// the task's "Local sync tests" list.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SyncController } from "../src/sync/controller.js";
import { LocalFolder } from "../src/sync/localFs.js";
import { createMemoryStore } from "../src/sync/store.js";
import * as S from "../src/workspace/state.js";
import { DirH } from "./memoryHandle.mjs";

const setup = async ({ files = [], local = {}, projectId = "p1" } = {}) => {
  let ws = S.workspaceFrom({ name: "t", language: "javascript", files: files.map(([path, content]) => ({ path, type: "file", content })), projectId, serverUpdatedAt: "x" });
  const folder = new DirH("my-project");
  for (const [path, text] of Object.entries(local)) folder.put(path, text);
  const store = createMemoryStore();
  const ctl = new SyncController({
    key: `u_1:${projectId}`, store,
    getWorkspace: () => ws,
    applyWorkspaceOps: async (ops) => { const r = S.applySyncOps(ws, ops); ws = r.ws; return r.results; },
    createFolder: (h) => new LocalFolder(h),
    pollMs: 1e9,
  });
  const api = {
    ctl, folder, store,
    get ws() { return ws; },
    setWs: (next) => { ws = next; },
    file: (path) => ws.nodes.find((n) => n.path === path),
    edit: (path, content) => { ws = S.editFile(ws, api.file(path).id, content); },
    connect: async () => { await ctl.chooseFolder(folder); await ctl.confirmConnect(); await ctl.chain; },
    sync: async () => { await ctl.syncNow(); await ctl.chain; },
    paths: () => ws.nodes.map((n) => n.path).sort(),
  };
  return api;
};

test("connect: preview first, nothing is written until confirmed; then files go both ways", async () => {
  const t = await setup({ files: [["main.js", "console.log(1)"], ["lib/util.js", "export {}"]], local: { "readme.md": "# hi" } });
  await t.ctl.chooseFolder(t.folder);
  assert.equal(t.ctl.state.status, "preview");
  assert.deepEqual([t.ctl.state.preview.toWorkspace, t.ctl.state.preview.toLocal], [1, 2]);
  assert.equal(t.folder.text("main.js"), null, "preview must not write");
  assert.equal(t.file("readme.md"), undefined);
  await t.ctl.confirmConnect(); await t.ctl.chain;
  assert.equal(t.ctl.state.status, "synced");
  assert.equal(t.folder.text("main.js"), "console.log(1)");
  assert.equal(t.folder.text("lib/util.js"), "export {}");
  assert.equal(t.file("readme.md").content, "# hi");
});

test("local edit reaches the Playground; Playground edit reaches the folder; no echo loop", async () => {
  const t = await setup({ files: [["a.js", "v1"]] });
  await t.connect();
  t.folder.put("a.js", "v2-local"); await t.sync();
  assert.equal(t.file("a.js").content, "v2-local");
  t.edit("a.js", "v3-playground"); await t.sync();
  assert.equal(t.folder.text("a.js"), "v3-playground");
  const before = t.ctl.rec.lastSyncedAt; const snapshot = JSON.stringify(t.ws.nodes);
  await t.sync(); await t.sync();
  assert.equal(JSON.stringify(t.ws.nodes), snapshot);
  assert.equal(t.folder.text("a.js"), "v3-playground");
  assert.equal(t.ctl.state.status, "synced");
  assert.ok(t.ctl.rec.lastSyncedAt >= before);
});

test("new files and folders sync in both directions", async () => {
  const t = await setup({ files: [["a.js", "1"]] });
  await t.connect();
  t.folder.put("src/deep/new.js", "local-new"); await t.sync();
  assert.equal(t.file("src/deep/new.js").content, "local-new");
  const created = S.addFile(t.ws, "", "fromPlayground.py", "print(1)"); t.setWs(created.ws);
  t.setWs(S.addFolder(t.ws, "", "emptydir").ws);
  await t.sync();
  assert.equal(t.folder.text("fromPlayground.py"), "print(1)");
  assert.ok(t.folder.list().includes("emptydir/"));
});

test("rename in the Playground moves the local file; rename on disk keeps the Playground node (same id)", async () => {
  const t = await setup({ files: [["a.js", "same content"], ["b.js", "other"]] });
  await t.connect();
  const id = t.file("a.js").id;
  t.setWs(S.renameItem(t.ws, id, "renamed.js")); await t.sync();
  assert.equal(t.folder.text("renamed.js"), "same content");
  assert.equal(t.folder.text("a.js"), null);
  assert.equal(t.ctl.state.pending.length, 0, "a rename is not a deletion");
  t.folder.put("moved/b2.js", "other"); t.folder.del("b.js"); await t.sync();
  assert.equal(t.file("b.js"), undefined);
  assert.equal(t.file("moved/b2.js").content, "other");
  assert.equal(t.ctl.state.pending.length, 0);
});

test("simultaneous edits are a conflict: nothing overwritten; each choice works and keeps a recoverable copy", async () => {
  const t = await setup({ files: [["a.js", "base"]] });
  await t.connect();
  t.folder.put("a.js", "LOCAL"); t.edit("a.js", "PLAYGROUND"); await t.sync();
  assert.equal(t.ctl.state.status, "conflict");
  assert.equal(t.ctl.state.conflicts.length, 1);
  assert.equal(t.folder.text("a.js"), "LOCAL"); assert.equal(t.file("a.js").content, "PLAYGROUND");
  await t.ctl.resolveConflict("a.js", "local");
  assert.equal(t.file("a.js").content, "LOCAL");
  assert.equal(t.ctl.state.status, "synced");
  assert.ok(t.ctl.state.trash.some((x) => x.content === "PLAYGROUND"), "losing version is recoverable");
  t.folder.put("a.js", "L2"); t.edit("a.js", "P2"); await t.sync();
  await t.ctl.resolveConflict("a.js", "playground");
  assert.equal(t.folder.text("a.js"), "P2");
  assert.ok(t.ctl.state.trash.some((x) => x.content === "L2"));
});

test("deletions are never automatic: they wait for a decision, 'keep' restores, 'delete' keeps a copy", async () => {
  const t = await setup({ files: [["a.js", "A"], ["b.js", "B"]] });
  await t.connect();
  t.folder.del("a.js"); t.setWs(S.deleteItem(t.ws, t.file("b.js").id)); await t.sync();
  assert.equal(t.file("a.js").content, "A", "local deletion did not delete the Playground file");
  assert.equal(t.folder.text("b.js"), "B", "Playground deletion did not delete the local file");
  assert.equal(t.ctl.state.pending.length, 2);
  assert.equal(t.ctl.state.status, "review");
  await t.ctl.resolvePending("a.js", "keep");
  assert.equal(t.folder.text("a.js"), "A");
  await t.ctl.resolvePending("b.js", "delete");
  assert.equal(t.folder.text("b.js"), null);
  assert.ok(t.ctl.state.trash.some((x) => x.content === "B"));
  assert.equal(t.ctl.state.pending.length, 0);
  await t.ctl.restoreTrash(t.ctl.state.trash.find((x) => x.content === "B").id);
  assert.equal(t.file("b (restored).js").content, "B");
  assert.equal(t.folder.text("b (restored).js"), "B");
});

test("excluded files never sync: node_modules, .git, build output, OS files, .env, keys, binaries, .gitignore'd", async () => {
  const local = { "ok.js": "1", "node_modules/x/i.js": "x", ".git/config": "[core]", "dist/o.js": "o", ".DS_Store": "z", ".env": "SECRET=1", "certs/a.pem": "k", "img/logo.png": "png", "private.txt": "p", ".gitignore": "private.txt\n", "package-lock.json": "{}" };
  const t = await setup({ files: [[".env.local", "PLAYGROUND_SECRET=1"]], local });
  t.folder.put("blob.bin", "", new Uint8Array([0, 1, 2, 255]));
  await t.connect();
  assert.deepEqual(t.paths(), [".env.local", ".gitignore", "certs", "img", "ok.js"]); // the folders themselves are fine; their excluded files are not
  assert.equal(t.folder.text(".env.local"), null, "a sensitive Playground file is not written to disk");
  const reasons = Object.fromEntries(t.ctl.state.skipped.map((s) => [s.path, s.kind]));
  assert.equal(reasons[".env"], "sensitive"); assert.equal(reasons["certs"], undefined);
  assert.equal(reasons["img/logo.png"], "binary"); assert.equal(reasons["blob.bin"], "binary");
});

test("sensitive files sync only after the user opts in", async () => {
  const t = await setup({ local: { ".env": "A=1", "x.js": "1" } });
  await t.connect();
  assert.equal(t.file(".env"), undefined);
  await t.ctl.setIncludeSensitive(true); await t.ctl.chain;
  assert.equal(t.file(".env").content, "A=1");
});

test("oversized files are skipped, the rest still syncs", async () => {
  const t = await setup({ local: { "big.txt": "x".repeat(100_001), "small.txt": "ok" } });
  await t.connect();
  assert.equal(t.file("big.txt"), undefined); assert.equal(t.file("small.txt").content, "ok");
  assert.ok(t.ctl.state.skipped.some((s) => s.path === "big.txt" && s.kind === "large"));
});

test("paths cannot escape the selected folder", async () => {
  const { safePath } = await import("../src/sync/localFs.js");
  for (const bad of ["../x", "a/../../x", "/etc/passwd", "a\\b", "a//b", ".."]) assert.throws(() => safePath(bad), undefined, bad);
  const t = await setup({ files: [["ok.js", "1"]] });
  await t.connect();
  const fs = t.ctl.fs;
  await assert.rejects(fs.write("../escape.txt", "x"));
  await assert.rejects(fs.remove("a/../../x"));
  assert.equal(t.folder.text("../escape.txt"), null);
});

test("CRLF files: line endings alone are not a change, and CRLF is kept when writing back", async () => {
  const t = await setup({ local: { "w.txt": "a\r\nb\r\n" } });
  await t.connect();
  assert.equal(t.file("w.txt").content, "a\nb\n");
  t.edit("w.txt", "a\nb\nc\n"); await t.sync();
  assert.equal(t.folder.text("w.txt"), "a\r\nb\r\nc\r\n");
  assert.equal(t.ctl.state.status, "synced");
});

test("an edit made while a cycle is running is not overwritten (guarded writes)", async () => {
  const t = await setup({ files: [["a.js", "base"]] });
  await t.connect();
  t.folder.put("a.js", "from-disk");
  const original = t.ctl.applyWorkspaceOps;
  t.ctl.applyWorkspaceOps = async (ops) => { t.edit("a.js", "typed-meanwhile"); return original(ops); };
  await t.sync();
  t.ctl.applyWorkspaceOps = original;
  assert.equal(t.file("a.js").content, "typed-meanwhile");
  await t.sync();
  assert.equal(t.ctl.state.status, "conflict");
});

test("permission lost -> 'permission' state, nothing runs; allowAccess resumes", async () => {
  const t = await setup({ files: [["a.js", "1"]] });
  await t.connect();
  t.folder.perm = "prompt";
  t.folder.put("a.js", "changed"); await t.sync();
  assert.equal(t.ctl.state.status, "permission");
  assert.equal(t.file("a.js").content, "1");
  await t.ctl.allowAccess(); await t.ctl.chain;
  assert.equal(t.file("a.js").content, "changed");
});

test("reload: a stored connection is restored and catches up on changes made while closed", async () => {
  const t = await setup({ files: [["a.js", "1"]] });
  await t.connect();
  t.ctl.destroy();
  t.folder.put("a.js", "edited-while-closed"); t.folder.put("new.js", "n");
  const again = new SyncController({ key: "u_1:p1", store: t.store, getWorkspace: () => t.ws, applyWorkspaceOps: async (ops) => { const r = S.applySyncOps(t.ws, ops); t.setWs(r.ws); return r.results; }, pollMs: 1e9 });
  await again.init(); await again.chain;
  assert.equal(t.file("a.js").content, "edited-while-closed");
  assert.equal(t.file("new.js").content, "n");
  assert.equal(again.state.folderName, "my-project");
  again.destroy();
});

test("disconnect stops syncing and forgets the folder; connections are per account and per project", async () => {
  const t = await setup({ files: [["a.js", "1"]] });
  await t.connect();
  assert.ok(await t.store.get("u_1:p1"));
  assert.equal(await t.store.get("u_2:p1"), null);
  assert.equal(await t.store.get("u_1:p2"), null);
  await t.ctl.disconnect();
  assert.equal(t.ctl.state.status, "disconnected");
  assert.equal(await t.store.get("u_1:p1"), null);
  t.folder.put("a.js", "after-disconnect"); await t.sync();
  assert.equal(t.file("a.js").content, "1");
  t.edit("a.js", "pg-after"); await t.sync();
  assert.equal(t.folder.text("a.js"), "after-disconnect");
});

test("a different project is never synced into the folder", async () => {
  const t = await setup({ files: [["a.js", "1"]] });
  await t.connect();
  t.setWs(S.workspaceFrom({ name: "other", language: "javascript", files: [{ path: "secret.js", type: "file", content: "x" }], projectId: "p2" }));
  await t.sync();
  assert.equal(t.folder.text("secret.js"), null);
});

test("too many files in the folder: error, nothing imported", async () => {
  const local = {};
  for (let i = 0; i < 230; i += 1) local[`f${i}.txt`] = "x";
  const t = await setup({ local });
  await t.ctl.chooseFolder(t.folder);
  assert.notEqual(t.ctl.state.status, "preview");
  assert.match(t.ctl.state.error, /more than/);
  assert.equal(t.ws.nodes.length, 0);
});

test("large one-sided deletion is flagged", async () => {
  const files = Array.from({ length: 6 }, (_, i) => [`f${i}.js`, String(i)]);
  const t = await setup({ files });
  await t.connect();
  for (let i = 0; i < 6; i += 1) t.folder.del(`f${i}.js`);
  await t.sync();
  assert.equal(t.ctl.state.massDeletion, true);
  assert.equal(t.ws.nodes.length, 6);
});
