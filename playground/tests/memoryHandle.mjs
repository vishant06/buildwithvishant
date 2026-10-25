// A small in-memory stand-in for the browser's FileSystemDirectoryHandle, enough
// for LocalFolder (getDirectoryHandle / getFileHandle / entries / removeEntry /
// createWritable). Used to test the real adapter and the sync controller in Node.
let clock = 1_700_000_000_000;
const err = (name) => Object.assign(new Error(name), { name });

class FileH {
  constructor(parent, name) { this.kind = "file"; this.parent = parent; this.name = name; }
  async getFile() {
    const rec = this.parent.files.get(this.name);
    const bytes = rec.bytes;
    return { size: bytes.length, lastModified: rec.mtime, text: async () => new TextDecoder().decode(bytes), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  }
  async createWritable() {
    const rec = this.parent.files.get(this.name);
    let text = "";
    return { write: async (data) => { text += data; }, close: async () => { rec.bytes = new TextEncoder().encode(text); rec.mtime = ++clock; } };
  }
}

export class DirH {
  constructor(name = "root") { this.kind = "directory"; this.name = name; this.files = new Map(); this.dirs = new Map(); this.perm = "granted"; }
  async queryPermission() { return this.perm; }
  async requestPermission() { this.perm = "granted"; return "granted"; }
  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.dirs.has(name)) { if (!create) throw err("NotFoundError"); this.dirs.set(name, new DirH(name)); }
    return this.dirs.get(name);
  }
  async getFileHandle(name, { create = false } = {}) {
    if (!this.files.has(name)) { if (!create) throw err("NotFoundError"); this.files.set(name, { bytes: new Uint8Array(), mtime: ++clock }); }
    return new FileH(this, name);
  }
  async removeEntry(name, { recursive = false } = {}) {
    if (this.files.delete(name)) return;
    const dir = this.dirs.get(name);
    if (!dir) throw err("NotFoundError");
    if (!recursive && (dir.files.size || dir.dirs.size)) throw err("InvalidModificationError");
    this.dirs.delete(name);
  }
  async *entries() {
    for (const name of this.files.keys()) yield [name, new FileH(this, name)];
    for (const [name, dir] of this.dirs) yield [name, dir];
  }
  // ---- test helpers (act like "the user edits files with another program")
  put(path, text, bytes) {
    const parts = path.split("/");
    let dir = this;
    for (const part of parts.slice(0, -1)) { if (!dir.dirs.has(part)) dir.dirs.set(part, new DirH(part)); dir = dir.dirs.get(part); }
    dir.files.set(parts.at(-1), { bytes: bytes || new TextEncoder().encode(text), mtime: ++clock });
  }
  text(path) {
    const parts = path.split("/");
    let dir = this;
    for (const part of parts.slice(0, -1)) { dir = dir.dirs.get(part); if (!dir) return null; }
    const rec = dir.files.get(parts.at(-1));
    return rec ? new TextDecoder().decode(rec.bytes) : null;
  }
  del(path) {
    const parts = path.split("/");
    let dir = this;
    for (const part of parts.slice(0, -1)) dir = dir.dirs.get(part);
    dir.files.delete(parts.at(-1));
  }
  list() {
    const out = [];
    const walk = (dir, prefix) => { for (const [n, r] of dir.files) out.push(prefix + n); for (const [n, d] of dir.dirs) { out.push(`${prefix}${n}/`); walk(d, `${prefix}${n}/`); } };
    walk(this, "");
    return out.sort();
  }
}
