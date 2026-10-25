// Two-way folder sync: the decision engine. Pure data in, plan out — no DOM, no
// React, no file access — so every rule below is covered by tests/sync-engine.test.js.
//
// The three-way idea. Besides the two sides we keep BASE: what each path looked
// like the last time both sides agreed. For every path:
//
//   local == playground                      -> in sync (just remember it)
//   only local differs from base             -> local edit      -> copy to the Playground
//   only the Playground differs from base    -> Playground edit -> copy to the local folder
//   both differ from base (and from each other) -> CONFLICT: nothing is overwritten
//   existed in base, now missing on one side -> DELETION: never applied automatically
//
// Because both sides are compared with what was last agreed (not with "now"), a
// change that has just been copied over is not copied back: that is what stops
// endless update loops. Content is compared with SHA-256 after line endings are
// normalised, so CRLF vs LF alone never counts as a change.
import { basename, dirname } from "@shared/workspace/core.js";

export const normalizeText = (text) => String(text ?? "").replace(/\r\n?/g, "\n");
export const detectEol = (text) => (/\r\n/.test(String(text)) ? "crlf" : "lf");
export const toEol = (text, eol) => (eol === "crlf" ? normalizeText(text).replace(/\n/g, "\r\n") : String(text));
export const keyOf = (path) => path.toLowerCase();

// ---- hashing (memoised: a file that has not changed is never hashed twice)

const memo = new Map();
let memoChars = 0;
const MEMO_MAX_CHARS = 1_500_000;

export const hashContent = async (text) => {
  const normalized = normalizeText(text);
  const hit = memo.get(normalized);
  if (hit) return hit;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  memo.set(normalized, hex);
  memoChars += normalized.length;
  while (memoChars > MEMO_MAX_CHARS && memo.size > 1) {
    const [oldest] = memo.keys();
    memoChars -= oldest.length;
    memo.delete(oldest);
  }
  return hex;
};

// entries: [{ path, type: "file" | "folder", content?, id?, eol? }]  ->  Map(key -> entry + { h, content normalised })
export const makeView = async (entries) => {
  const view = new Map();
  for (const entry of entries) {
    const key = keyOf(entry.path);
    if (view.has(key)) continue; // a second path differing only by letter case is ignored
    if (entry.type === "file") {
      const content = normalizeText(entry.content);
      // `content` is line-ending normalised (used for hashing and for copying); `raw` is the text exactly as
      // stored, which is what an "is it still unchanged?" guard has to compare against.
      view.set(key, { ...entry, content, raw: String(entry.content ?? ""), h: await hashContent(content), eol: entry.eol || detectEol(entry.content ?? "") });
    } else view.set(key, { ...entry, h: "" });
  }
  return view;
};

// ---- planning

const fileBase = (path, h, id, eol) => ({ path, type: "file", h, id, eol });
const folderBase = (path) => ({ path, type: "folder" });

export const emptyPlan = () => ({ toWorkspace: [], toLocal: [], settle: [], conflicts: [], pending: [], problems: [], renames: 0 });

// base: { [key]: { path, type, h?, id?, eol? } }
export const reconcile = ({ local, remote, base }) => {
  const plan = emptyPlan();
  const handled = new Set();
  const remoteById = new Map();
  for (const entry of remote.values()) if (entry.id) remoteById.set(entry.id, entry);

  // ---- renames, detected from content (local side) or from node ids (Playground side)
  const goneLocal = [];
  const newLocal = [];
  for (const [key, b] of Object.entries(base)) {
    const r = remote.get(key);
    if (b.type === "file" && !local.has(key) && r?.type === "file" && r.h === b.h) goneLocal.push([key, b, r]);
  }
  for (const [key, l] of local) if (l.type === "file" && !remote.has(key) && !base[key]) newLocal.push([key, l]);
  const countBy = (list, hashOf) => list.reduce((map, item) => map.set(hashOf(item), (map.get(hashOf(item)) || 0) + 1), new Map());
  const goneCount = countBy(goneLocal, ([, b]) => b.h);
  const newCount = countBy(newLocal, ([, l]) => l.h);
  for (const [oldKey, b, r] of goneLocal) {
    if (goneCount.get(b.h) !== 1 || newCount.get(b.h) !== 1) continue; // ambiguous: fall back to delete + create
    const found = newLocal.find(([, l]) => l.h === b.h);
    if (!found) continue;
    const [newKey, l] = found;
    plan.toWorkspace.push({
      kind: "move", from: r.path, to: l.path, id: r.id, expectContent: r.raw,
      base: [{ key: oldKey, entry: null }, { key: newKey, entry: fileBase(l.path, l.h, r.id, l.eol) }],
    });
    handled.add(oldKey).add(newKey);
    plan.renames += 1;
  }
  for (const [oldKey, b] of Object.entries(base)) {
    if (handled.has(oldKey) || b.type !== "file" || !b.id) continue;
    const l = local.get(oldKey);
    const moved = remoteById.get(b.id);
    if (!l || l.type !== "file" || l.h !== b.h || remote.has(oldKey) || !moved || moved.type !== "file") continue;
    const newKey = keyOf(moved.path);
    if (newKey === oldKey || local.has(newKey) || base[newKey]) continue;
    plan.toLocal.push({
      kind: "move", from: l.path, to: moved.path, content: moved.content, eol: b.eol || l.eol, expectContent: l.content,
      base: [{ key: oldKey, entry: null }, { key: newKey, entry: fileBase(moved.path, moved.h, moved.id, b.eol || l.eol) }],
    });
    handled.add(oldKey).add(newKey);
    plan.renames += 1;
  }

  // ---- everything else, path by path
  const keys = new Set([...local.keys(), ...remote.keys(), ...Object.keys(base)]);
  for (const key of keys) {
    if (handled.has(key)) continue;
    const l = local.get(key);
    const r = remote.get(key);
    const b = base[key];
    if (l && r && l.type !== r.type) {
      plan.problems.push({ path: r.path, message: `"${r.path}" is a ${r.type} in the Playground but a ${l.type} in the local folder, so it was left alone.` });
      continue;
    }
    const type = (l || r || b).type;

    if (type === "folder") {
      if (l && r) {
        if (!b || b.type !== "folder") plan.settle.push({ key, entry: folderBase(r.path) });
      } else if (l && !r) {
        if (b) plan.toLocal.push({ kind: "rmdir", path: l.path, base: [{ key, entry: null }] }); // removed in the Playground: remove here, but only if empty
        else plan.toWorkspace.push({ kind: "folder", path: l.path, base: [{ key, entry: folderBase(l.path) }] });
      } else if (!l && r) {
        if (b) plan.toWorkspace.push({ kind: "rmdir", path: r.path, base: [{ key, entry: null }] });
        else plan.toLocal.push({ kind: "folder", path: r.path, base: [{ key, entry: folderBase(r.path) }] });
      } else if (b) plan.settle.push({ key, entry: null });
      continue;
    }

    const hb = b && b.type === "file" ? b.h : undefined;
    const eol = l?.eol || b?.eol;
    if (l && r) {
      if (l.h === r.h) {
        if (!b || b.h !== l.h || b.path !== r.path || b.id !== r.id) plan.settle.push({ key, entry: fileBase(r.path, l.h, r.id, l.eol) });
      } else if (hb !== undefined && l.h === hb) {
        plan.toLocal.push({ kind: "write", path: l.path, content: r.content, eol, expectContent: l.content, base: [{ key, entry: fileBase(r.path, r.h, r.id, eol) }] });
      } else if (hb !== undefined && r.h === hb) {
        plan.toWorkspace.push({ kind: "write", path: r.path, content: l.content, expectContent: r.raw, base: [{ key, entry: fileBase(r.path, l.h, r.id, l.eol) }] });
      } else {
        plan.conflicts.push({ key, path: r.path, local: pick(l), remote: pick(r), base: hb ?? null });
      }
    } else if (l && !r) {
      if (!b) plan.toWorkspace.push({ kind: "write", path: l.path, content: l.content, expectContent: null, base: [{ key, entry: fileBase(l.path, l.h, undefined, l.eol) }] });
      else if (l.h === hb) plan.pending.push({ key, path: l.path, deletedIn: "workspace", content: l.content, h: l.h, eol: l.eol });
      else plan.conflicts.push({ key, path: l.path, local: pick(l), remote: null, base: hb ?? null });
    } else if (!l && r) {
      if (!b) plan.toLocal.push({ kind: "write", path: r.path, content: r.content, eol: "lf", expectContent: null, base: [{ key, entry: fileBase(r.path, r.h, r.id, "lf") }] });
      else if (r.h === hb) plan.pending.push({ key, path: r.path, deletedIn: "local", content: r.content, raw: r.raw, h: r.h, id: r.id });
      else plan.conflicts.push({ key, path: r.path, local: null, remote: pick(r), base: hb ?? null });
    } else if (b) {
      plan.settle.push({ key, entry: null }); // gone from both sides
    }
  }
  return plan;
};

const pick = (entry) => ({ path: entry.path, content: entry.content, raw: entry.raw, h: entry.h, id: entry.id, eol: entry.eol });

// ---- user decisions -> operations

// choice: "local" (keep the local-folder version) | "playground" (keep the Playground version).
// The version that loses is copied to the sync trash first, so it can be restored.
export const conflictOps = (conflict, choice) => {
  const { key, local, remote } = conflict;
  const ops = { toWorkspace: [], toLocal: [] };
  if (choice === "local") {
    if (!local) {
      ops.toWorkspace.push({ kind: "delete", path: remote.path, expectContent: remote.raw, trash: trashOf(remote, "playground", "replaced by your choice"), base: [{ key, entry: null }] });
    } else {
      ops.toWorkspace.push({
        kind: "write", path: remote?.path || local.path, content: local.content, expectContent: remote ? remote.raw : null,
        trash: remote ? trashOf(remote, "playground", "replaced by the local version") : undefined,
        base: [{ key, entry: fileBase(remote?.path || local.path, local.h, remote?.id, local.eol) }],
      });
    }
  } else if (!remote) {
    ops.toLocal.push({ kind: "delete", path: local.path, expectContent: local.content, trash: trashOf(local, "local", "replaced by your choice"), base: [{ key, entry: null }] });
  } else {
    ops.toLocal.push({
      kind: "write", path: local?.path || remote.path, content: remote.content, eol: local?.eol, expectContent: local ? local.content : null,
      trash: local ? trashOf(local, "local", "replaced by the Playground version") : undefined,
      base: [{ key, entry: fileBase(remote.path, remote.h, remote.id, local?.eol) }],
    });
  }
  return ops;
};

// choice: "delete" (carry the deletion over, keeping a recoverable copy) | "keep" (undo it: copy the file back).
export const pendingOps = (item, choice) => {
  const ops = { toWorkspace: [], toLocal: [] };
  const { key, path, content, deletedIn } = item;
  if (choice === "delete") {
    const op = { kind: "delete", path, expectContent: deletedIn === "local" ? item.raw : content, trash: { path, content, side: deletedIn === "local" ? "playground" : "local", reason: "deleted by sync" }, base: [{ key, entry: null }] };
    (deletedIn === "local" ? ops.toWorkspace : ops.toLocal).push(op);
  } else if (deletedIn === "local") {
    ops.toLocal.push({ kind: "write", path, content, eol: "lf", expectContent: null, base: [{ key, entry: fileBase(path, item.h, item.id, "lf") }] });
  } else {
    ops.toWorkspace.push({ kind: "write", path, content, expectContent: null, base: [{ key, entry: fileBase(path, item.h, undefined, item.eol) }] });
  }
  return ops;
};

const trashOf = (side, from, reason) => ({ path: side.path, content: side.content, side: from, reason });

// "src/Main.java" -> "src/Main (restored).java"
export const restoredPath = (path, exists) => {
  const dir = dirname(path);
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 0; ; i += 1) {
    const candidate = `${stem} (restored${i ? ` ${i + 1}` : ""})${ext}`;
    const full = dir ? `${dir}/${candidate}` : candidate;
    if (!exists(full)) return full;
  }
};

// Fill in Playground node ids on file entries so a later rename inside the
// Playground can be recognised (ids survive renames, paths do not).
export const refreshIds = (base, nodes) => {
  const byKey = new Map(nodes.map((node) => [keyOf(node.path), node]));
  const next = {};
  for (const [key, entry] of Object.entries(base)) {
    const node = byKey.get(key);
    next[key] = entry.type === "file" && node?.type === "file" ? { ...entry, id: node.id, path: node.path } : entry;
  }
  return next;
};

export const applyBaseUpdates = (base, updates) => {
  const next = { ...base };
  for (const { key, entry } of updates) {
    if (entry) next[key] = entry;
    else delete next[key];
  }
  return next;
};
