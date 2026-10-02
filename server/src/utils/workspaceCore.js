// Workspace core — pure functions with NO imports, shared by the Playground UI
// and the API server. The single source of truth is this file; the server keeps
// a byte-identical copy at server/src/utils/workspaceCore.js
// (run `npm run sync:workspace` in server/ after editing; `npm run check:workspace` verifies).
//
// Paths are always "/"-separated, relative to the project root, with no leading
// slash ("src/Main.java"). Every path that crosses a trust boundary goes
// through normalizePath()/validateWorkspace().

export const LIMITS = Object.freeze({
  maxNodes: 200, // files + folders in one project
  maxFileBytes: 100_000, // one file (UTF-8 bytes)
  maxProjectBytes: 500_000, // all file contents together
  maxDepth: 8, // folders + file name ("a/b/c.txt" has depth 3)
  maxNameLength: 100,
  maxPathLength: 240,
});

// Extensions (lower-case, with dot) that count as source code per execution language.
export const LANGUAGE_EXTENSIONS = Object.freeze({
  javascript: ['.js', '.mjs', '.cjs'],
  typescript: ['.ts'],
  python: ['.py'],
  c: ['.c'],
  cpp: ['.cpp', '.cc', '.cxx', '.c++'],
  java: ['.java'],
  csharp: ['.cs'],
  go: ['.go'],
  rust: ['.rs'],
  ruby: ['.rb'],
  php: ['.php'],
  kotlin: ['.kt', '.kts'],
  swift: ['.swift'],
  dart: ['.dart'],
  r: ['.r'],
  scala: ['.scala'],
  shell: ['.sh'],
  sql: ['.sql'],
  lua: ['.lua'],
  perl: ['.pl'],
  haskell: ['.hs'],
});

export const HEADER_EXTENSIONS = Object.freeze({
  c: ['.h'],
  cpp: ['.h', '.hpp', '.hh', '.hxx'],
});

export class WorkspaceError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'WorkspaceError';
    if (details) this.details = details;
  }
}

// ---------------------------------------------------------------- paths

const BAD_NAME_CHARS = /[\u0000-\u001f\u007f\\/:*?"<>|]/;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export const makeId = () => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 20);
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
};

const safeId = (value) => (typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : '');

// One file or folder name (no slashes). Returns the trimmed name or throws.
export const validateName = (raw, label = 'Name') => {
  if (typeof raw !== 'string') throw new WorkspaceError(`${label} must be text.`);
  const name = raw.trim();
  if (!name) throw new WorkspaceError(`${label} cannot be empty.`);
  if (name === '.' || name === '..') throw new WorkspaceError(`"${name}" is not a valid ${label.toLowerCase()}.`);
  if (name.length > LIMITS.maxNameLength) throw new WorkspaceError(`${label} is too long (max ${LIMITS.maxNameLength} characters).`);
  if (BAD_NAME_CHARS.test(name)) throw new WorkspaceError(`${label} cannot contain / \\ : * ? " < > | or control characters.`);
  if (name.endsWith('.')) throw new WorkspaceError(`${label} cannot end with a dot.`);
  if (RESERVED_NAMES.test(name)) throw new WorkspaceError(`"${name}" is a reserved name on some systems. Choose another ${label.toLowerCase()}.`);
  return name;
};

// A relative path. Rejects absolute paths, backslashes, empty segments,
// "." / ".." segments (path traversal), over-long or too-deep paths.
export const normalizePath = (raw) => {
  if (typeof raw !== 'string') throw new WorkspaceError('Path must be text.');
  if (raw.length > LIMITS.maxPathLength) throw new WorkspaceError(`Path is too long (max ${LIMITS.maxPathLength} characters).`);
  if (raw.includes('\\')) throw new WorkspaceError('Paths must use "/" as the separator.');
  if (raw.startsWith('/')) throw new WorkspaceError('Paths must be relative to the project root.');
  const parts = raw.split('/');
  if (parts.some((part) => part.trim() === '..')) throw new WorkspaceError('Path traversal ("..") is not allowed.');
  const clean = parts.map((part) => validateName(part, 'Path segment'));
  if (clean.length > LIMITS.maxDepth) throw new WorkspaceError(`Folders can be nested at most ${LIMITS.maxDepth} levels deep.`);
  return clean.join('/');
};

export const basename = (path) => path.slice(path.lastIndexOf('/') + 1);
export const dirname = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
export const joinPath = (dir, name) => (dir ? `${dir}/${name}` : name);
export const depthOf = (path) => (path ? path.split('/').length : 0);
export const isInside = (path, folderPath) => path === folderPath || path.startsWith(`${folderPath}/`);

// ".java" for "Main.java"; "" for "Makefile" and ".gitignore".
export const extname = (name) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
};

export const byteLength = (text) => new TextEncoder().encode(text).length;

// ----------------------------------------------------------- workspaces

// Validates and canonicalises a workspace received from anywhere (UI, API, ZIP import).
// Input:  { files: [{ id?, path, type: 'file'|'folder', content? }], entryFile? }
// Output: { nodes (sorted by path, ancestors guaranteed), entryFile, totalBytes }
export const validateWorkspace = (input) => {
  const list = input?.files;
  if (!Array.isArray(list)) throw new WorkspaceError('Project files must be a list.');
  if (list.length > LIMITS.maxNodes) throw new WorkspaceError(`A project can contain at most ${LIMITS.maxNodes} files and folders.`);

  const byPath = new Map(); // lower-case path -> node
  const usedIds = new Set();
  let totalBytes = 0;

  const addNode = (node) => {
    const key = node.path.toLowerCase();
    const existing = byPath.get(key);
    if (existing) {
      if (existing.type === 'folder' && node.type === 'folder' && node.implicit) return existing;
      throw new WorkspaceError(
        existing.path === node.path
          ? `Duplicate path "${node.path}".`
          : `"${node.path}" conflicts with "${existing.path}" (names that differ only by letter case are not allowed).`,
      );
    }
    let id = safeId(node.id);
    if (!id || usedIds.has(id)) id = makeId();
    usedIds.add(id);
    const stored = { id, path: node.path, type: node.type };
    if (node.type === 'file') stored.content = node.content;
    byPath.set(key, stored);
    return stored;
  };

  for (const item of list) {
    if (!item || typeof item !== 'object') throw new WorkspaceError('Invalid project entry.');
    if (item.type !== 'file' && item.type !== 'folder') throw new WorkspaceError(`Unknown entry type for "${String(item.path)}".`);
    const path = normalizePath(item.path);
    if (item.type === 'file') {
      const content = item.content === undefined || item.content === null ? '' : item.content;
      if (typeof content !== 'string') throw new WorkspaceError(`Content of "${path}" must be text.`);
      const bytes = byteLength(content);
      if (bytes > LIMITS.maxFileBytes) throw new WorkspaceError(`"${path}" is too large (max ${Math.round(LIMITS.maxFileBytes / 1000)} KB per file).`);
      totalBytes += bytes;
      if (totalBytes > LIMITS.maxProjectBytes) throw new WorkspaceError(`The project is too large (max ${Math.round(LIMITS.maxProjectBytes / 1000)} KB in total).`);
      addNode({ id: item.id, path, type: 'file', content });
    } else {
      addNode({ id: item.id, path, type: 'folder' });
    }
  }

  // Every ancestor must exist as a folder (create missing ones, reject file/folder clashes).
  for (const node of [...byPath.values()]) {
    let dir = dirname(node.path);
    while (dir) {
      const found = byPath.get(dir.toLowerCase());
      if (!found) addNode({ path: dir, type: 'folder', implicit: true });
      else if (found.type !== 'folder') throw new WorkspaceError(`"${found.path}" is a file, so it cannot contain "${node.path}".`);
      dir = dirname(dir);
    }
  }
  if (byPath.size > LIMITS.maxNodes) throw new WorkspaceError(`A project can contain at most ${LIMITS.maxNodes} files and folders.`);

  const nodes = [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  let entryFile = '';
  if (input.entryFile) {
    entryFile = normalizePath(input.entryFile);
    const entry = byPath.get(entryFile.toLowerCase());
    if (!entry || entry.type !== 'file') throw new WorkspaceError(`Entry file "${entryFile}" does not exist in the project.`);
    entryFile = entry.path;
  }
  return { nodes, entryFile, totalBytes };
};

// ----------------------------------------------------------------- Java
// Enough of Java's lexical structure to find top-level type declarations
// without being fooled by comments, strings, text blocks or nested classes.

const maskJava = (source) => {
  const out = source.split('');
  const n = source.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      let j = i;
      while (j < n && source[j] !== '\n') j += 1;
      blank(i, j);
      i = j;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      blank(i, j);
      i = j;
    } else if (c === '"' && source.startsWith('"""', i)) {
      let j = i + 3;
      while (j < n && !(source.startsWith('"""', j) && source[j - 1] !== '\\')) j += 1;
      j = Math.min(n, j + 3);
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && source[j] !== c && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      blank(i, Math.min(n, j + 1));
      i = Math.min(n, j + 1);
    } else {
      i += 1;
    }
  }
  return out.join('');
};

const TYPE_DECLARATION =
  /(?<![\w$.@])((?:(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\s+)*)(@\s*interface|class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/g;
const MAIN_METHOD =
  /\bstatic\s+(?:final\s+)?void\s+main\s*\(\s*(?:final\s+)?String\s*(?:\[\s*\]|\.\.\.)\s*[\w$]+\s*\)|\bstatic\s+(?:final\s+)?void\s+main\s*\(\s*(?:final\s+)?String\s+[\w$]+\s*\[\s*\]\s*\)/;

const KIND_LABEL = { class: 'class', interface: 'interface', enum: 'enum', record: 'record', '@interface': 'annotation' };

export const analyzeJava = (source) => {
  const masked = maskJava(source);
  const depth = new Int32Array(masked.length + 1);
  for (let i = 0; i < masked.length; i += 1) {
    depth[i + 1] = depth[i] + (masked[i] === '{' ? 1 : masked[i] === '}' ? -1 : 0);
  }
  const lineAt = (index) => {
    let line = 1;
    for (let i = 0; i < index; i += 1) if (masked[i] === '\n') line += 1;
    return line;
  };

  const types = [];
  TYPE_DECLARATION.lastIndex = 0;
  for (let m = TYPE_DECLARATION.exec(masked); m; m = TYPE_DECLARATION.exec(masked)) {
    const kind = m[2].replace(/\s+/g, '');
    const name = m[3];
    if (depth[m.index] !== 0) continue; // nested type
    if (kind === 'record' && !/^\s*(?:<[^>(){}]*>)?\s*\(/.test(masked.slice(m.index + m[0].length))) continue; // "record" used as an identifier
    types.push({ kind: kind === '@interface' ? '@interface' : kind, name, isPublic: /\bpublic\b/.test(m[1]), line: lineAt(m.index) });
  }
  const pkg = /^\s*package\s+([\w$.]+)\s*;/m.exec(masked);
  return { packageName: pkg ? pkg[1] : '', types, hasMain: MAIN_METHOD.test(masked) };
};

const javaLabel = (kind) => KIND_LABEL[kind] || 'class';
const stem = (path) => basename(path).replace(/\.java$/i, '');

// Checks a Java project and works out the class to run.
// files: [{ path, content }]. entryPath: explicit entry (optional).
// Returns { errors: [{ path, line, message }], entryPath, mainClass }.
export const checkJavaProject = (files, entryPath = '') => {
  const errors = [];
  const sources = files.filter((file) => /\.java$/i.test(file.path)).sort((a, b) => (a.path < b.path ? -1 : 1));
  const analysis = new Map(sources.map((file) => [file.path, analyzeJava(file.content || '')]));

  for (const file of sources) {
    const expected = stem(file.path);
    for (const type of analysis.get(file.path).types) {
      if (type.isPublic && type.name !== expected) {
        errors.push({
          path: file.path,
          line: type.line,
          message: `Public ${javaLabel(type.kind)} '${type.name}' must be declared in a file named '${type.name}.java'.`,
        });
      }
    }
  }

  const withMain = sources.filter((file) => analysis.get(file.path).hasMain);
  let entry = entryPath;
  if (entry) {
    const file = sources.find((item) => item.path === entry);
    if (!file) {
      errors.push({ path: entry, line: 1, message: `Entry file '${basename(entry)}' is not a .java file in this project.` });
    } else if (!analysis.get(entry).hasMain) {
      const hint = withMain.length ? ` Files with a main method: ${withMain.map((item) => item.path).join(', ')}.` : '';
      errors.push({ path: entry, line: 1, message: `Entry file '${basename(entry)}' has no 'public static void main(String[] args)' method.${hint} Use "Set as Entry File" to choose another.` });
    }
  } else if (withMain.length) {
    entry = withMain[0].path;
  } else {
    errors.push({ path: sources[0]?.path || '', line: 1, message: "No file contains a 'public static void main(String[] args)' method, so there is nothing to run." });
  }

  let mainClass = '';
  const info = entry && analysis.get(entry);
  if (info && info.types.length) {
    const chosen = info.types.find((type) => type.name === stem(entry)) || info.types[0];
    mainClass = info.packageName ? `${info.packageName}.${chosen.name}` : chosen.name;
  }
  return { errors, entryPath: entry, mainClass };
};
