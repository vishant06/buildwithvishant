// Access to the folder the user picked, through the browser's File System Access
// API (Chrome / Edge / Opera on desktop). The browser itself enforces the
// boundary: a FileSystemDirectoryHandle can only reach files inside the folder
// the user chose in the system dialog, and writing needs the user's permission.
// On top of that this module validates every path (no "..", no absolute paths,
// no odd names) before it touches the handle, so a bad path from either side
// can never be turned into a file operation outside the folder.
import { LIMITS, basename, dirname, normalizePath } from "@shared/workspace/core.js";
import { buildIgnore, classifySyncPath } from "@shared/workspace/rules.js";
import { detectEol, normalizeText } from "./engine.js";

export const supportsLocalSync = () =>
  typeof window !== "undefined" && window.isSecureContext && typeof window.showDirectoryPicker === "function";

const MAX_VISITED = 4000; // entries looked at before giving up (a project folder, not a home directory)
const PERMISSION = { mode: "readwrite" };

export const pickFolder = () => window.showDirectoryPicker({ id: "bwv-playground-sync", mode: "readwrite" });

// Strict relative path check, shared with the server rules.
export const safePath = (path) => normalizePath(path);

const isMissing = (error) => error?.name === "NotFoundError" || error?.name === "TypeMismatchError";

export class LocalFolder {
  constructor(handle) {
    this.root = handle;
    this.name = handle.name;
    this.cache = new Map(); // path -> { lastModified, size, result }
  }

  async permission(request = false) {
    try {
      let state = (await this.root.queryPermission?.(PERMISSION)) ?? "granted";
      if (state !== "granted" && request) state = (await this.root.requestPermission?.(PERMISSION)) ?? state;
      return state;
    } catch {
      return "denied";
    }
  }

  async dir(path, create = false) {
    let handle = this.root;
    if (!path) return handle;
    for (const part of safePath(path).split("/")) handle = await handle.getDirectoryHandle(part, { create });
    return handle;
  }

  async readTop(name) {
    try {
      const file = await (await this.root.getFileHandle(name)).getFile();
      return file.size > 200_000 ? "" : await file.text();
    } catch {
      return "";
    }
  }

  // Reads one text file. Returns null when it does not exist.
  async read(path) {
    try {
      const parent = await this.dir(dirname(path));
      const file = await (await parent.getFileHandle(basename(path))).getFile();
      return decodeText(await file.arrayBuffer())?.text ?? null;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async write(path, text) {
    const parent = await this.dir(dirname(path), true);
    const handle = await parent.getFileHandle(basename(path), { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(text);
    } finally {
      await writable.close();
    }
    this.cache.delete(path);
  }

  async remove(path) {
    const parent = await this.dir(dirname(path));
    await parent.removeEntry(basename(path));
    this.cache.delete(path);
  }

  async mkdir(path) {
    await this.dir(path, true);
  }

  // Removes a folder only if it is empty (never recursive). Returns "removed" | "missing" | "not-empty".
  async rmdirIfEmpty(path) {
    try {
      const parent = await this.dir(dirname(path));
      await parent.removeEntry(basename(path), { recursive: false });
      return "removed";
    } catch (error) {
      if (isMissing(error)) return "missing";
      if (error?.name === "InvalidModificationError") return "not-empty";
      throw error;
    }
  }

  // Lists everything that takes part in the sync, applying the ignore rules.
  //   entries : [{ path, type, content?, eol? }]   (text content, line endings as found)
  //   skipped : [{ path, kind, reason }]           (sensitive / binary / too large / odd name)
  //   ignore  : the matcher used (so the Playground side is filtered identically)
  async scan({ includeSensitive = false } = {}) {
    const ignore = buildIgnore({ gitignore: await this.readTop(".gitignore"), playgroundignore: await this.readTop(".playgroundignore") });
    const result = { entries: [], skipped: [], ignore, truncated: false, tooMany: false };
    const seen = new Set();
    let visited = 0;

    const walk = async (dir, prefix) => {
      const children = [];
      for await (const [name, handle] of dir.entries()) children.push([name, handle]);
      children.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (const [name, handle] of children) {
        visited += 1;
        if (visited > MAX_VISITED) {
          result.truncated = true;
          return;
        }
        const path = prefix ? `${prefix}/${name}` : name;
        const isDir = handle.kind === "directory";
        try {
          safePath(path);
        } catch {
          result.skipped.push({ path, kind: "name", reason: "unsupported file or folder name" });
          continue;
        }
        const verdict = classifySyncPath(path, { ignore, isDir, includeSensitive });
        if (!verdict.sync) {
          if (verdict.kind !== "ignored") result.skipped.push({ path, kind: verdict.kind, reason: verdict.reason });
          continue;
        }
        if (seen.has(path.toLowerCase())) {
          result.skipped.push({ path, kind: "name", reason: "differs only by letter case from another item" });
          continue;
        }
        seen.add(path.toLowerCase());
        if (isDir) {
          result.entries.push({ path, type: "folder" });
          await walk(handle, path);
          if (result.truncated) return;
        } else {
          const file = await this.fileEntry(path, handle);
          if (file.skip) result.skipped.push({ path, kind: file.skip.kind, reason: file.skip.reason });
          else result.entries.push(file.entry);
        }
      }
    };

    await walk(this.root, "");
    result.tooMany = result.entries.length > LIMITS.maxNodes;
    return result;
  }

  async fileEntry(path, handle) {
    const file = await handle.getFile();
    const cached = this.cache.get(path);
    if (cached && cached.lastModified === file.lastModified && cached.size === file.size) return cached.result;
    let result;
    if (file.size > LIMITS.maxFileBytes) {
      result = { skip: { kind: "large", reason: `larger than ${Math.round(LIMITS.maxFileBytes / 1000)} KB` } };
    } else {
      const decoded = decodeText(await file.arrayBuffer());
      result = decoded
        ? { entry: { path, type: "file", content: decoded.text, eol: decoded.eol } }
        : { skip: { kind: "binary", reason: "not a text file" } };
    }
    this.cache.set(path, { lastModified: file.lastModified, size: file.size, result });
    return result;
  }
}

// UTF-8 text or null (binary / not valid UTF-8). A byte-order mark is dropped.
export const decodeText = (buffer) => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (text.includes("\u0000")) return null;
    return { text, eol: detectEol(text) };
  } catch {
    return null;
  }
};

export { normalizeText };
