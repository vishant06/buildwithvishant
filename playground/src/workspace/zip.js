import { LIMITS, WorkspaceError, byteLength, normalizePath } from "@shared/workspace/core.js";

// Minimal ZIP support, no dependencies.
//  - createZip: "stored" (uncompressed) archive; plenty for text projects (<= 500 KB).
//  - readZip:   reads stored + deflate entries, with hard limits so a hostile
//               archive can neither escape the project (zip-slip) nor blow up memory.
// Nothing here ever executes extracted content.

const encoder = new TextEncoder();

let crcTable;
const crc32 = (bytes) => {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date) => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

// entries: [{ path: "src/Main.java", content: "text" }, { path: "empty-folder/", folder: true }]
export const createZip = (entries, now = new Date()) => {
  const stamp = dosDateTime(now);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const isDir = Boolean(entry.folder);
    const name = encoder.encode(isDir && !entry.path.endsWith("/") ? `${entry.path}/` : entry.path);
    const data = isDir ? new Uint8Array(0) : encoder.encode(entry.content ?? "");
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 0x031e, true); // made by Unix, v3.0
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, stamp.time, true);
    dir.setUint16(14, stamp.date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(38, (isDir ? (0o040755 << 16) | 0x10 : 0o100644 << 16) >>> 0, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
};

// ---- reading

const SKIP_PARTS = new Set(["__MACOSX", ".git", "node_modules", ".idea", ".vscode"]);

const inflate = async (bytes, limit) => {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new WorkspaceError("A file in the ZIP is larger than the allowed size.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

// Reads a ZIP into { files: [{ path, content }], skipped: [{ path, reason }] }.
// Paths are validated with normalizePath (no "..", no absolute paths, no
// backslashes); unsafe or unsupported entries are skipped and reported, never extracted.
export const readZip = async (buffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: true });

  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new WorkspaceError("This does not look like a ZIP file.");
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cursor === 0xffffffff) throw new WorkspaceError("ZIP64 archives are not supported.");
  if (count > LIMITS.maxNodes * 5) throw new WorkspaceError("The ZIP contains too many entries.");

  const files = [];
  const skipped = [];
  let total = 0;

  for (let n = 0; n < count; n += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new WorkspaceError("The ZIP file is damaged.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const rawName = new TextDecoder("utf-8").decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (rawName.endsWith("/")) continue; // directory entry; folders come from file paths
    const skip = (reason) => skipped.push({ path: rawName, reason });

    let path;
    try {
      path = normalizePath(rawName.replace(/^\.\//, ""));
    } catch (error) {
      skip(error.message);
      continue;
    }
    if (path.split("/").some((part) => SKIP_PARTS.has(part)) || path.endsWith(".DS_Store")) {
      skip("ignored system/dependency folder");
      continue;
    }
    if (flags & 1) { skip("encrypted"); continue; }
    if (method !== 0 && method !== 8) { skip("unsupported compression"); continue; }
    if (size > LIMITS.maxFileBytes) { skip("file is too large"); continue; }
    if (files.length >= LIMITS.maxNodes) { skip("too many files"); continue; }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) { skip("damaged entry"); continue; }

    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const stored = bytes.subarray(dataStart, dataStart + compressedSize);
    let data;
    try {
      data = method === 0 ? stored : await inflate(stored, LIMITS.maxFileBytes);
    } catch {
      skip("could not be decompressed or is too large");
      continue;
    }
    if (data.length > LIMITS.maxFileBytes) { skip("file is too large"); continue; }

    let content;
    try {
      content = decoder.decode(data);
    } catch {
      skip("not a text file");
      continue;
    }
    if (content.includes("\u0000")) { skip("not a text file"); continue; }

    total += byteLength(content);
    if (total > LIMITS.maxProjectBytes) throw new WorkspaceError("The ZIP is larger than the allowed project size.");
    files.push({ path, content });
  }
  return { files, skipped };
};
