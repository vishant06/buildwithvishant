import {
  LIMITS,
  WorkspaceError,
  basename,
  byteLength,
  depthOf,
  dirname,
  isInside,
  joinPath,
  makeId,
  normalizePath,
  validateName,
} from "@shared/workspace/core.js";

// Pure operations on a workspace's node list:
//   node = { id, type: "file" | "folder", path, content? }   (name = basename(path))
// Every operation returns a NEW list (or throws WorkspaceError with a message
// fit to show the user). Paths are the single source of truth; ids stay stable
// across rename/move so tabs and the entry file follow their file.

export const nameOf = (node) => basename(node.path);
const lower = (path) => path.toLowerCase();

export const findById = (nodes, id) => nodes.find((node) => node.id === id) || null;
export const findByPath = (nodes, path) => nodes.find((node) => lower(node.path) === lower(path)) || null;
export const isFolder = (node) => node?.type === "folder";
export const descendantsOf = (nodes, folderPath) => nodes.filter((node) => node.path !== folderPath && isInside(node.path, folderPath));

const compareNames = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

// Hierarchical view for rendering: folders first, then files, each A-Z.
export const buildTree = (nodes) => {
  const byParent = new Map();
  for (const node of nodes) {
    const parent = dirname(node.path);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(node);
  }
  const build = (parent) =>
    (byParent.get(parent) || [])
      .sort((a, b) => (a.type === b.type ? compareNames(nameOf(a), nameOf(b)) : a.type === "folder" ? -1 : 1))
      .map((node) => ({ ...node, name: nameOf(node), children: node.type === "folder" ? build(node.path) : undefined }));
  return build("");
};

export const folderPaths = (nodes) => nodes.filter(isFolder).map((node) => node.path).sort(compareNames);

export const totalBytes = (nodes) => nodes.reduce((sum, node) => sum + (node.type === "file" ? byteLength(node.content || "") : 0), 0);

const assertLimits = (nodes) => {
  if (nodes.length > LIMITS.maxNodes) throw new WorkspaceError(`A project can contain at most ${LIMITS.maxNodes} files and folders.`);
  for (const node of nodes) {
    if (depthOf(node.path) > LIMITS.maxDepth) throw new WorkspaceError(`Folders can be nested at most ${LIMITS.maxDepth} levels deep.`);
  }
  if (totalBytes(nodes) > LIMITS.maxProjectBytes) throw new WorkspaceError(`The project is too large (max ${Math.round(LIMITS.maxProjectBytes / 1000)} KB in total).`);
};

// A path may be used when nothing (ignoring letter case) is there already.
const assertFree = (nodes, path, ignoreId) => {
  const clash = nodes.find((node) => node.id !== ignoreId && lower(node.path) === lower(path));
  if (clash) {
    throw new WorkspaceError(
      `A ${clash.type} named "${nameOf(clash)}" already exists${dirname(path) ? ` in "${dirname(path)}"` : " here"}.`,
    );
  }
};

// Folders needed so that `path` has all its ancestors; returns the new folder nodes.
const missingAncestors = (nodes, path) => {
  const created = [];
  let dir = dirname(path);
  const chain = [];
  while (dir) {
    chain.unshift(dir);
    dir = dirname(dir);
  }
  for (const folder of chain) {
    const found = findByPath([...nodes, ...created], folder);
    if (!found) created.push({ id: makeId(), type: "folder", path: folder });
    else if (found.type !== "folder") throw new WorkspaceError(`"${found.path}" is a file, so it cannot contain other items.`);
  }
  return created;
};

// `typed` is what the user entered: "Main.java" or "src/utils/Helper.java".
const resolveTyped = (dirPath, typed) => {
  if (typeof typed !== "string" || !typed.trim()) throw new WorkspaceError("Name cannot be empty.");
  const cleaned = typed.trim().replace(/\/+$/, "");
  return normalizePath(joinPath(dirPath, cleaned));
};

export const createFile = (nodes, dirPath, typed, content = "") => {
  const path = resolveTyped(dirPath, typed);
  assertFree(nodes, path);
  const folders = missingAncestors(nodes, path);
  const node = { id: makeId(), type: "file", path, content };
  const next = [...nodes, ...folders, node];
  assertLimits(next);
  return { nodes: next, node, createdFolders: folders };
};

export const createFolder = (nodes, dirPath, typed) => {
  const path = resolveTyped(dirPath, typed);
  assertFree(nodes, path);
  const folders = missingAncestors(nodes, path);
  const node = { id: makeId(), type: "folder", path };
  const next = [...nodes, ...folders, node];
  assertLimits(next);
  return { nodes: next, node, createdFolders: folders };
};

const rewrite = (nodes, id, newPath) => {
  const target = findById(nodes, id);
  const oldPath = target.path;
  return nodes.map((node) => {
    if (node.id === id) return { ...node, path: newPath };
    if (target.type === "folder" && isInside(node.path, oldPath)) return { ...node, path: newPath + node.path.slice(oldPath.length) };
    return node;
  });
};

export const renameNode = (nodes, id, rawName) => {
  const target = findById(nodes, id);
  if (!target) throw new WorkspaceError("That item no longer exists.");
  const name = validateName(rawName, target.type === "folder" ? "Folder name" : "File name");
  if (name === nameOf(target)) return nodes;
  const newPath = joinPath(dirname(target.path), name);
  assertFree(nodes, newPath, id);
  return rewrite(nodes, id, newPath);
};

// destDir: "" (project root) or the path of an existing folder.
export const moveNode = (nodes, id, destDir) => {
  const target = findById(nodes, id);
  if (!target) throw new WorkspaceError("That item no longer exists.");
  if (destDir) {
    const dest = findByPath(nodes, destDir);
    if (!dest || dest.type !== "folder") throw new WorkspaceError("The destination folder does not exist.");
    destDir = dest.path;
  }
  if (target.type === "folder" && destDir && isInside(destDir, target.path)) throw new WorkspaceError("A folder cannot be moved into itself.");
  if (dirname(target.path) === destDir) return nodes;
  const newPath = joinPath(destDir, nameOf(target));
  assertFree(nodes, newPath, id);
  const next = rewrite(nodes, id, newPath);
  assertLimits(next);
  return next;
};

export const deleteNode = (nodes, id) => {
  const target = findById(nodes, id);
  if (!target) return { nodes, removedIds: [] };
  const doomed = nodes.filter((node) => node.id === id || (target.type === "folder" && isInside(node.path, target.path)));
  const gone = new Set(doomed.map((node) => node.id));
  return { nodes: nodes.filter((node) => !gone.has(node.id)), removedIds: [...gone] };
};

// "Student.java" -> "Student copy.java" -> "Student copy 2.java"
const copyName = (nodes, dirPath, name, isDir) => {
  const dot = isDir ? -1 : name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = `${stem} copy${ext}`;
  for (let i = 2; findByPath(nodes, joinPath(dirPath, candidate)); i += 1) candidate = `${stem} copy ${i}${ext}`;
  return candidate;
};

export const duplicateNode = (nodes, id) => {
  const target = findById(nodes, id);
  if (!target) throw new WorkspaceError("That item no longer exists.");
  const dir = dirname(target.path);
  const newPath = joinPath(dir, copyName(nodes, dir, nameOf(target), target.type === "folder"));
  const copies = [{ ...target, id: makeId(), path: newPath }];
  if (target.type === "folder") {
    for (const child of descendantsOf(nodes, target.path)) copies.push({ ...child, id: makeId(), path: newPath + child.path.slice(target.path.length) });
  }
  const next = [...nodes, ...copies];
  assertLimits(next);
  return { nodes: next, node: copies[0] };
};

// "name.ext" -> "name (1).ext" when taken (used for uploads).
export const uniquePath = (nodes, dirPath, name) => {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let i = 1; findByPath(nodes, joinPath(dirPath, candidate)); i += 1) candidate = `${stem} (${i})${ext}`;
  return joinPath(dirPath, candidate);
};
