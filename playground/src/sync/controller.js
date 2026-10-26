// The sync loop for ONE project <-> ONE local folder. Framework-free (the React
// hook in useLocalSync.js is a thin wrapper), so the same code runs in the
// browser and in the browser-level tests.
//
// A cycle: scan the folder -> compare with the Playground files and with BASE ->
// apply what is safe in each direction -> remember the new BASE. Cycles never
// overlap (one queue). Triggers: every few seconds while the tab is visible, when
// you come back to the tab (editing in another window), shortly after you stop
// typing in the Playground, and "Sync now".
//
// Safety rules enforced here:
//  * the first connection only PREVIEWS; nothing is written until the user confirms
//  * deletions are never applied by themselves; they wait for the user's choice,
//    and a recoverable copy is kept when one is applied
//  * conflicts are never auto-resolved
//  * every write re-checks that the target still holds what was compared
//  * sensitive / ignored / binary / oversized files never take part
import { LIMITS } from "@shared/workspace/core.js";
import { classifySyncPath } from "@shared/workspace/rules.js";
import { LocalFolder } from "./localFs.js";
import {
  applyBaseUpdates, conflictOps, detectEol, makeView, normalizeText, pendingOps, reconcile, refreshIds, restoredPath, toEol,
} from "./engine.js";

const POLL_MS = 2500;
const DEBOUNCE_MS = 700;
const MAX_RETRY = 3;

export const initialState = (status = "disconnected") => ({
  status, // unsupported | disconnected | permission | connecting | preview | syncing | synced | review | conflict | paused | error
  folderName: "",
  lastSyncedAt: null,
  error: "",
  conflicts: [],
  pending: [],
  skipped: [],
  problems: [],
  preview: null,
  trash: [],
  includeSensitive: false,
  massDeletion: false,
  log: [],
});

const depth = (path) => path.split("/").length;
const phase = (op) => ({ folder: 0, write: 1, move: 1, delete: 2, rmdir: 3 })[op.kind] ?? 1;

export class SyncController {
  constructor({ key, store, getWorkspace, applyWorkspaceOps, supported = true, createFolder = (handle) => new LocalFolder(handle), pollMs = POLL_MS, now = () => Date.now() }) {
    this.key = key;
    this.store = store;
    this.getWorkspace = getWorkspace;
    this.applyWorkspaceOps = applyWorkspaceOps;
    this.createFolder = createFolder;
    this.pollMs = pollMs;
    this.now = now;
    this.state = initialState(supported ? "disconnected" : "unsupported");
    this.supported = supported;
    this.listeners = new Set();
    this.rec = null;
    this.fs = null;
    this.candidate = null;
    this.paused = false;
    this.running = false;
    this.disposed = false;
    this.chain = Promise.resolve();
    this.queued = false;
    this.retries = 0;
    this.timer = null;
    this.debounce = null;
    this.projectId = getWorkspace()?.projectId || null;
  }

  // ---- observable state
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(patch) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  logError(message) {
    this.set({ error: message, log: [{ at: this.now(), message }, ...this.state.log].slice(0, 20) });
  }

  // ---- lifecycle
  async init() {
    if (!this.supported) return;
    const rec = await this.store.get(this.key);
    if (this.disposed) return;
    if (!rec) return this.set({ status: "disconnected", trash: await this.store.listTrash(this.key) });
    this.rec = rec;
    this.fs = this.createFolder(rec.handle);
    this.set({ folderName: rec.folderName, lastSyncedAt: rec.lastSyncedAt, includeSensitive: Boolean(rec.settings?.includeSensitive), trash: await this.store.listTrash(this.key) });
    await this.resume();
  }

  // Needs a click: browsers only show the permission prompt in response to a user gesture.
  async allowAccess() {
    if (!this.fs) return;
    const state = await this.fs.permission(true);
    if (state === "granted") await this.resume();
    else this.set({ status: "permission", error: "Access to the folder was not granted." });
  }

  async resume() {
    if (!this.rec) return;
    if ((await this.fs.permission(false)) !== "granted") {
      this.stopTimer();
      return this.set({ status: "permission", error: "" });
    }
    this.paused = false;
    this.set({ status: "syncing", error: "" });
    this.startTimer();
    return this.syncNow();
  }

  pause() {
    this.paused = true;
    this.stopTimer();
    this.set({ status: "paused" });
  }

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) this.syncNow();
    }, this.pollMs);
    this.timer.unref?.();
  }
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  destroy() {
    this.disposed = true;
    this.stopTimer();
    clearTimeout(this.debounce);
    this.listeners.clear();
  }

  async disconnect() {
    this.stopTimer();
    clearTimeout(this.debounce);
    await this.chain.catch(() => undefined);
    await this.store.remove(this.key);
    await this.store.clearTrash(this.key);
    this.rec = null;
    this.fs = null;
    this.candidate = null;
    this.paused = false;
    this.set({ ...initialState(this.supported ? "disconnected" : "unsupported") });
  }

  notifyWorkspaceChanged() {
    if (!this.rec || this.paused || this.state.status === "permission") return;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.syncNow(), DEBOUNCE_MS);
    this.debounce.unref?.();
  }

  syncNow() {
    if (!this.rec || this.paused || this.disposed || this.queued) return this.chain;
    this.queued = true;
    this.chain = this.chain.then(() => {
      this.queued = false;
      return this.cycle();
    }).catch((error) => this.logError(error?.message || "Sync failed."));
    return this.chain;
  }

  // ---- connecting (first time): preview, then confirm
  async chooseFolder(handle) {
    const fs = this.createFolder(handle);
    this.set({ status: "connecting", error: "" });
    if ((await fs.permission(true)) !== "granted") return this.set({ status: this.rec ? this.state.status : "disconnected", error: "Access to the folder was not granted." });
    try {
      const scan = await fs.scan({ includeSensitive: false });
      if (scan.truncated) throw new Error("That folder has too many items. Choose your project folder, not a parent directory.");
      if (scan.tooMany) throw new Error(`That folder has more than the ${LIMITS.maxNodes} files and folders a Playground project can hold (after ignore rules). Add a .playgroundignore file or choose a smaller folder.`);
      const { plan, skipped } = await this.plan(scan, {}, false);
      this.candidate = { handle, fs };
      this.set({
        status: "preview",
        preview: {
          folderName: handle.name,
          toWorkspace: plan.toWorkspace.filter((op) => op.kind === "write").length,
          toLocal: plan.toLocal.filter((op) => op.kind === "write").length,
          conflicts: plan.conflicts.length,
          same: plan.settle.length,
          files: {
            toWorkspace: plan.toWorkspace.filter((op) => op.kind === "write").map((op) => op.path).slice(0, 8),
            toLocal: plan.toLocal.filter((op) => op.kind === "write").map((op) => op.path).slice(0, 8),
            conflicts: plan.conflicts.map((c) => c.path).slice(0, 8),
          },
        },
        skipped,
      });
    } catch (error) {
      this.set({ status: this.rec ? "paused" : "disconnected", error: error.message || "That folder could not be read." });
    }
  }

  cancelPreview() {
    this.candidate = null;
    this.set({ preview: null, status: this.rec ? "paused" : "disconnected", skipped: this.rec ? this.state.skipped : [] });
  }

  async confirmConnect() {
    if (!this.candidate) return;
    const { handle, fs } = this.candidate;
    this.rec = { key: this.key, handle, folderName: handle.name, base: {}, settings: { includeSensitive: false }, connectedAt: this.now(), lastSyncedAt: null };
    this.fs = fs;
    this.candidate = null;
    await this.store.put(this.rec);
    this.set({ preview: null, folderName: handle.name, includeSensitive: false });
    await this.resume();
  }

  async setIncludeSensitive(value) {
    if (!this.rec) return;
    this.rec = { ...this.rec, settings: { ...this.rec.settings, includeSensitive: Boolean(value) } };
    await this.store.put(this.rec);
    this.set({ includeSensitive: Boolean(value) });
    await this.syncNow();
  }

  // ---- planning
  async plan(scan, base, includeSensitive) {
    const ws = this.getWorkspace();
    const skipped = [...scan.skipped];
    const remoteEntries = [];
    for (const node of ws.nodes) {
      const verdict = classifySyncPath(node.path, { ignore: scan.ignore, isDir: node.type === "folder", includeSensitive });
      if (verdict.sync) remoteEntries.push({ path: node.path, type: node.type, content: node.content, id: node.id });
      else if (verdict.kind !== "ignored") skipped.push({ path: node.path, kind: verdict.kind, reason: `${verdict.reason} (Playground file, not copied to the folder)` });
    }
    const [local, remote] = await Promise.all([makeView(scan.entries), makeView(remoteEntries)]);
    return { plan: reconcile({ local, remote, base }), skipped, local, remote };
  }

  // ---- one cycle
  async cycle() {
    if (!this.rec || this.paused || this.disposed) return;
    const ws = this.getWorkspace();
    if (!ws || ws.projectId !== this.projectId) return; // never sync a different project into this folder
    if ((await this.fs.permission(false)) !== "granted") {
      this.stopTimer();
      return this.set({ status: "permission" });
    }
    this.set({ status: "syncing" });
    try {
      const includeSensitive = Boolean(this.rec.settings?.includeSensitive);
      const scan = await this.fs.scan({ includeSensitive });
      if (scan.truncated) throw new Error("The folder has too many items. Choose your project folder, not a parent directory.");
      if (scan.tooMany) throw new Error("The folder has more files than a Playground project can hold. Add ignore rules (.playgroundignore) or choose a smaller folder.");

      const { plan, skipped } = await this.plan(scan, this.rec.base, includeSensitive);
      const outcome = await this.execute(plan);

      let base = applyBaseUpdates(this.rec.base, outcome.updates);
      base = refreshIds(base, this.getWorkspace().nodes);
      this.rec = { ...this.rec, base, lastSyncedAt: this.now() };
      await this.store.put(this.rec);

      const baseFiles = Object.values(this.rec.base).filter((entry) => entry.type === "file").length;
      const massDeletion = plan.pending.length >= 5 && plan.pending.length >= baseFiles / 2;
      const needsRetry = outcome.changed && this.retries < MAX_RETRY;
      this.retries = needsRetry ? this.retries + 1 : 0;
      if (outcome.failures.length) this.logError(outcome.failures.slice(0, 3).join(" "));
      this.set({
        lastSyncedAt: this.rec.lastSyncedAt,
        conflicts: plan.conflicts,
        pending: plan.pending,
        problems: plan.problems,
        skipped,
        massDeletion,
        error: outcome.failures.length ? outcome.failures[0] : "",
        status: outcome.failures.length ? "error" : plan.conflicts.length ? "conflict" : plan.pending.length ? "review" : "synced",
        trash: await this.store.listTrash(this.key),
      });
      if (needsRetry) setTimeout(() => this.syncNow(), 300).unref?.();
    } catch (error) {
      this.logError(error?.message || "Sync failed.");
      this.set({ status: "error" });
    }
  }

  // Runs a plan. Returns { updates (to BASE), failures, changed }.
  async execute(plan) {
    const updates = [...plan.settle];
    const failures = [];
    let changed = false;
    const done = (op) => updates.push(...(op.base || []));

    if (plan.toWorkspace.length) {
      for (const op of plan.toWorkspace) if (op.trash) await this.store.addTrash(this.key, op.trash);
      const results = await this.applyWorkspaceOps(plan.toWorkspace);
      for (const result of results) {
        if (result.ok) done(result.op);
        else if (result.skipped) changed = true;
        else if (!result.deferred) failures.push(`${result.op.path || result.op.to}: ${result.error}`);
      }
    }

    const local = [...plan.toLocal].sort((a, b) => phase(a) - phase(b) || (a.kind === "rmdir" ? depth(b.path) - depth(a.path) : 0));
    for (const op of local) {
      try {
        const outcome = await this.runLocalOp(op);
        if (outcome === "done") done(op);
        else if (outcome === "changed") changed = true;
      } catch (error) {
        failures.push(`${op.path || op.to}: ${error?.message || error?.name || "could not write the file"}`);
      }
    }
    return { updates, failures, changed };
  }

  // "done" | "changed" (target moved under us: re-plan) | "deferred"
  async runLocalOp(op) {
    const fs = this.fs;
    const same = (current, expected) => current !== null && expected !== null && normalizeText(current) === normalizeText(expected);
    if (op.kind === "folder") {
      await fs.mkdir(op.path);
      return "done";
    }
    if (op.kind === "rmdir") return (await fs.rmdirIfEmpty(op.path)) === "not-empty" ? "deferred" : "done";
    if (op.kind === "write") {
      const current = await fs.read(op.path);
      if (op.expectContent === null ? current !== null : !same(current, op.expectContent)) return "changed";
      if (op.trash) await this.store.addTrash(this.key, op.trash);
      await fs.write(op.path, toEol(op.content, op.eol || (current !== null ? detectEol(current) : "lf")));
      return "done";
    }
    if (op.kind === "delete") {
      const current = await fs.read(op.path);
      if (current === null) return "done";
      if (!same(current, op.expectContent)) return "changed";
      if (op.trash) await this.store.addTrash(this.key, op.trash);
      await fs.remove(op.path);
      return "done";
    }
    if (op.kind === "move") {
      const current = await fs.read(op.from);
      if (!same(current, op.expectContent)) return "changed";
      if ((await fs.read(op.to)) !== null && op.to.toLowerCase() !== op.from.toLowerCase()) return "changed";
      await fs.write(op.to, toEol(op.content, op.eol || "lf"));
      await fs.remove(op.from);
      return "done";
    }
    throw new Error(`Unknown operation ${op.kind}`);
  }

  // ---- user decisions
  async runDecision(ops) {
    await this.chain.catch(() => undefined);
    this.chain = (async () => {
      const plan = { toWorkspace: ops.toWorkspace, toLocal: ops.toLocal, settle: [] };
      const outcome = await this.execute(plan);
      this.rec = { ...this.rec, base: refreshIds(applyBaseUpdates(this.rec.base, outcome.updates), this.getWorkspace().nodes) };
      await this.store.put(this.rec);
      if (outcome.failures.length) this.logError(outcome.failures[0]);
    })().catch((error) => this.logError(error?.message || "Could not apply that choice."));
    await this.chain;
    await this.syncNow();
  }

  resolveConflict(key, choice) {
    const conflict = this.state.conflicts.find((item) => item.key === key);
    return conflict ? this.runDecision(conflictOps(conflict, choice)) : undefined;
  }

  resolvePending(key, choice) {
    const item = this.state.pending.find((entry) => entry.key === key);
    return item ? this.runDecision(pendingOps(item, choice)) : undefined;
  }

  resolveAllPending(choice) {
    const merged = { toWorkspace: [], toLocal: [] };
    for (const item of this.state.pending) {
      const ops = pendingOps(item, choice);
      merged.toWorkspace.push(...ops.toWorkspace);
      merged.toLocal.push(...ops.toLocal);
    }
    return this.runDecision(merged);
  }

  // Puts a recoverable copy back into the Playground as "name (restored).ext"; sync then
  // writes it to the folder like any new file.
  async restoreTrash(id) {
    const item = this.state.trash.find((entry) => entry.id === id);
    if (!item) return;
    const taken = new Set(this.getWorkspace().nodes.map((node) => node.path.toLowerCase()));
    const path = restoredPath(item.path, (candidate) => taken.has(candidate.toLowerCase()));
    const [result] = await this.applyWorkspaceOps([{ kind: "write", path, content: normalizeText(item.content), expectContent: null }]);
    if (result?.ok) {
      await this.store.removeTrash(id);
      this.set({ trash: await this.store.listTrash(this.key) });
      await this.syncNow();
    } else this.logError(result?.error || "Could not restore that file.");
  }

  async discardTrash(id) {
    await this.store.removeTrash(id);
    this.set({ trash: await this.store.listTrash(this.key) });
  }
}
