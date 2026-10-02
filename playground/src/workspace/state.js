import {
  LANGUAGE_EXTENSIONS,
  WorkspaceError,
  analyzeJava,
  basename,
  dirname,
  extname,
  makeId,
  validateName,
  validateWorkspace,
} from "@shared/workspace/core.js";
import { defaultFileName, demos, initial } from "./languages.js";
import * as tree from "./tree.js";

// Workspace state, as plain data + pure transitions (the React hook is a thin
// wrapper). Shape:
//   {
//     projectId, serverUpdatedAt,      // set once the project exists in the database
//     name, language,
//     nodes: [{ id, type, path, content? }],
//     entryId,                         // id of the file the Run button starts from
//     openIds, activeId, selectedId,   // editor tabs, active tab, explorer selection
//     expanded: [folder ids],
//     baseline: { [id]: { path, h } }, // what was last saved/loaded (hashes, not copies)
//     baselineMeta: { name, language, entryId }
//   }

export const hashText = (text = "") => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length}:${h >>> 0}`;
};

const baselineOf = (nodes) => Object.fromEntries(nodes.map((node) => [node.id, { path: node.path, h: node.type === "file" ? hashText(node.content) : "" }]));

const withBaseline = (ws) => ({
  ...ws,
  baseline: baselineOf(ws.nodes),
  baselineMeta: { name: ws.name, language: ws.language, entryId: ws.entryId },
});

export const nodeById = (ws, id) => tree.findById(ws.nodes, id);
export const entryNode = (ws) => (ws.entryId ? nodeById(ws, ws.entryId) : null);
export const entryPath = (ws) => entryNode(ws)?.path || "";

// ---- entry file selection

const hasMain = (node) => node.type === "file" && /\.java$/i.test(node.path) && analyzeJava(node.content || "").hasMain;

// Which file Run should start from when the user has not chosen one.
export const guessEntry = (language, nodes) => {
  const files = nodes.filter((node) => node.type === "file").sort((a, b) => (a.path.length - b.path.length) || (a.path < b.path ? -1 : 1));
  if (!files.length) return null;
  if (language === "web") return (files.find((file) => file.path.toLowerCase() === "index.html") || files.find((file) => extname(basename(file.path)) === ".html") || files[0]).id;
  const wanted = defaultFileName(language).toLowerCase();
  const byName = files.find((file) => basename(file.path).toLowerCase() === wanted);
  if (byName) return byName.id;
  if (language === "java") {
    const main = files.find(hasMain);
    if (main) return main.id;
  }
  const exts = LANGUAGE_EXTENSIONS[language] || [];
  return (files.find((file) => exts.includes(extname(basename(file.path)))) || files[0]).id;
};

// ---- construction

const expandAll = (nodes) => nodes.filter(tree.isFolder).map((node) => node.id);

const finish = (ws) => {
  const entryId = ws.entryId && tree.findById(ws.nodes, ws.entryId) ? ws.entryId : guessEntry(ws.language, ws.nodes);
  const openIds = (ws.openIds || []).filter((id) => tree.findById(ws.nodes, id)?.type === "file");
  const first = entryId || ws.nodes.find((node) => node.type === "file")?.id || null;
  if (!openIds.length && first) openIds.push(first);
  const activeId = openIds.includes(ws.activeId) ? ws.activeId : openIds[0] || null;
  return { ...ws, entryId, openIds, activeId, selectedId: ws.selectedId && tree.findById(ws.nodes, ws.selectedId) ? ws.selectedId : activeId };
};

// A fresh project for a language: one demo file (or the HTML/CSS/JS trio).
export const templateWorkspace = (language, name = "Untitled playground") => {
  const nodes =
    language === "web"
      ? [
          { id: makeId(), type: "file", path: "index.html", content: initial.html },
          { id: makeId(), type: "file", path: "style.css", content: initial.css },
          { id: makeId(), type: "file", path: "script.js", content: initial.javascript },
        ]
      : [{ id: makeId(), type: "file", path: defaultFileName(language), content: demos[language] || "" }];
  return withBaseline(finish({ projectId: null, serverUpdatedAt: null, name, language, nodes, entryId: null, expanded: [] }));
};

// Build from validated nodes (database project, ZIP import, restored draft).
export const workspaceFrom = ({ name, language, files, entryFile = "", projectId = null, serverUpdatedAt = null, saved = true }) => {
  const { nodes, entryFile: entryPathChecked } = validateWorkspace({ files, entryFile });
  const entry = entryPathChecked ? tree.findByPath(nodes, entryPathChecked) : null;
  const ws = finish({ projectId, serverUpdatedAt, name, language, nodes, entryId: entry?.id || null, expanded: expandAll(nodes) });
  return saved ? withBaseline(ws) : { ...ws, baseline: {}, baselineMeta: null };
};

// The server's view of a project (GET /playground/:id -> project.workspace).
export const workspaceFromProject = (project) =>
  workspaceFrom({
    name: project.title,
    language: project.language || "web",
    files: project.workspace.files,
    entryFile: project.workspace.entryFile,
    projectId: project._id,
    serverUpdatedAt: project.updatedAt,
  });

// Draft saved by the single-file Playground ({ code, language, file, singleCode, title }).
export const workspaceFromLegacyDraft = (draft) => {
  const language = draft.language || "web";
  const name = draft.title || "Untitled playground";
  if (language === "web") {
    const code = draft.code || initial;
    return workspaceFrom({
      name,
      language,
      files: [
        { path: "index.html", type: "file", content: String(code.html ?? "") },
        { path: "style.css", type: "file", content: String(code.css ?? "") },
        { path: "script.js", type: "file", content: String(code.javascript ?? "") },
      ],
      entryFile: "index.html",
      saved: false,
    });
  }
  const text = String(draft.singleCode ?? "");
  const publicType = language === "java" ? analyzeJava(text).types.filter((type) => type.isPublic) : [];
  const path = publicType.length === 1 ? `${publicType[0].name}.java` : defaultFileName(language);
  return workspaceFrom({ name, language, files: [{ path, type: "file", content: text }], entryFile: path, saved: false });
};

// ---- derived state

export const isFileDirty = (ws, id) => {
  const node = nodeById(ws, id);
  if (!node || node.type !== "file") return false;
  const base = ws.baseline?.[id];
  return !base || base.path !== node.path || base.h !== hashText(node.content);
};

export const isProjectDirty = (ws) => {
  if (!ws.baselineMeta) return true;
  const meta = ws.baselineMeta;
  if (meta.name !== ws.name || meta.language !== ws.language || meta.entryId !== ws.entryId) return true;
  const baselineIds = Object.keys(ws.baseline);
  if (baselineIds.length !== ws.nodes.length) return true;
  return ws.nodes.some((node) => {
    const base = ws.baseline[node.id];
    return !base || base.path !== node.path || (node.type === "file" && base.h !== hashText(node.content));
  });
};

export const dirtyFileIds = (ws) => ws.nodes.filter((node) => node.type === "file" && isFileDirty(ws, node.id)).map((node) => node.id);

// ---- transitions (all return a new workspace or throw WorkspaceError)

const ancestorsExpanded = (ws, path) => {
  const ids = new Set(ws.expanded);
  let dir = dirname(path);
  while (dir) {
    const folder = tree.findByPath(ws.nodes, dir);
    if (folder) ids.add(folder.id);
    dir = dirname(dir);
  }
  return [...ids];
};

export const openFile = (ws, id) => {
  const node = nodeById(ws, id);
  if (!node || node.type !== "file") return ws;
  return {
    ...ws,
    openIds: ws.openIds.includes(id) ? ws.openIds : [...ws.openIds, id],
    activeId: id,
    selectedId: id,
    expanded: ancestorsExpanded(ws, node.path),
  };
};

export const closeTab = (ws, id) => {
  if (!ws.openIds.includes(id)) return ws;
  const index = ws.openIds.indexOf(id);
  const openIds = ws.openIds.filter((openId) => openId !== id);
  const activeId = ws.activeId === id ? openIds[Math.min(index, openIds.length - 1)] || null : ws.activeId;
  return { ...ws, openIds, activeId };
};

export const activate = (ws, id) => (ws.openIds.includes(id) ? { ...ws, activeId: id, selectedId: id } : ws);
export const select = (ws, id) => ({ ...ws, selectedId: id });

export const editFile = (ws, id, content) => {
  let changed = false;
  const nodes = ws.nodes.map((node) => {
    if (node.id !== id || node.type !== "file" || node.content === content) return node;
    changed = true;
    return { ...node, content };
  });
  return changed ? { ...ws, nodes } : ws;
};

export const toggleFolder = (ws, id) => ({ ...ws, expanded: ws.expanded.includes(id) ? ws.expanded.filter((open) => open !== id) : [...ws.expanded, id] });
export const setExpanded = (ws, id, open) => (ws.expanded.includes(id) === open ? ws : toggleFolder(ws, id));

export const addFile = (ws, dirPath, typed, content = "") => {
  const result = tree.createFile(ws.nodes, dirPath, typed, content);
  const withNodes = { ...ws, nodes: result.nodes, expanded: [...ws.expanded, ...result.createdFolders.map((folder) => folder.id)] };
  return { ws: openFile(withNodes, result.node.id), node: result.node };
};

export const addFolder = (ws, dirPath, typed) => {
  const result = tree.createFolder(ws.nodes, dirPath, typed);
  const expanded = [...new Set([...ws.expanded, ...result.createdFolders.map((folder) => folder.id), result.node.id])];
  return { ws: { ...ws, nodes: result.nodes, expanded, selectedId: result.node.id }, node: result.node };
};

export const renameItem = (ws, id, name) => ({ ...ws, nodes: tree.renameNode(ws.nodes, id, name) });

export const moveItem = (ws, id, destDir) => {
  const nodes = tree.moveNode(ws.nodes, id, destDir);
  const moved = { ...ws, nodes };
  const node = tree.findById(nodes, id);
  return { ...moved, expanded: ancestorsExpanded(moved, node.path) };
};

export const deleteItem = (ws, id) => {
  const { nodes, removedIds } = tree.deleteNode(ws.nodes, id);
  if (!removedIds.length) return ws;
  const gone = new Set(removedIds);
  let next = { ...ws, nodes, expanded: ws.expanded.filter((open) => !gone.has(open)), selectedId: gone.has(ws.selectedId) ? null : ws.selectedId };
  for (const removed of removedIds) next = closeTab(next, removed);
  // The entry file was deleted: fall back to the best guess instead of leaving Run pointing nowhere.
  if (gone.has(ws.entryId)) next = { ...next, entryId: guessEntry(next.language, next.nodes) };
  return next;
};

export const duplicateItem = (ws, id) => {
  const result = tree.duplicateNode(ws.nodes, id);
  const next = { ...ws, nodes: result.nodes, expanded: result.node.type === "folder" ? [...ws.expanded, result.node.id] : ws.expanded };
  return { ws: result.node.type === "file" ? openFile(next, result.node.id) : { ...next, selectedId: result.node.id }, node: result.node };
};

export const setEntry = (ws, id) => {
  const node = nodeById(ws, id);
  if (!node || node.type !== "file") throw new WorkspaceError("Only files can be the entry file.");
  return { ...ws, entryId: id };
};

// Typing in the project-name box: any text up to 100 characters (validated on Save).
export const setName = (ws, name) => ({ ...ws, name: String(name).slice(0, 100) });

// Adds uploaded/imported files into a folder; collisions get "name (1).ext".
export const addFiles = (ws, dirPath, incoming) => {
  let nodes = ws.nodes;
  const added = [];
  for (const file of incoming) {
    const path = tree.uniquePath(nodes, dirPath, validateName(file.name, "File name"));
    const result = tree.createFile(nodes, dirname(path), basename(path), file.content);
    nodes = result.nodes;
    added.push(result.node);
  }
  let next = { ...ws, nodes };
  if (added[0]) next = openFile(next, added[0].id);
  return { ws: next, added };
};

// After a successful save: this is now the saved baseline.
export const markSaved = (ws, project) =>
  withBaseline({ ...ws, projectId: project._id, serverUpdatedAt: project.updatedAt, name: project.title });

// ---- boundary with the API

export const toPayload = (ws) => ({
  title: ws.name,
  language: ws.language,
  files: ws.nodes.map((node) => (node.type === "file" ? { id: node.id, path: node.path, type: "file", content: node.content } : { id: node.id, path: node.path, type: "folder" })),
  entryFile: entryPath(ws),
});

// Source files for the executor (folders and unrelated assets are filtered server-side).
export const executionFiles = (ws) => ws.nodes.filter((node) => node.type === "file").map((node) => ({ path: node.path, content: node.content }));

// ---- drafts (localStorage)

export const snapshot = (ws) => ({
  v: 2,
  projectId: ws.projectId,
  serverUpdatedAt: ws.serverUpdatedAt,
  name: ws.name,
  language: ws.language,
  nodes: ws.nodes,
  entryId: ws.entryId,
  openIds: ws.openIds,
  activeId: ws.activeId,
  expanded: ws.expanded,
  baseline: ws.baseline,
  baselineMeta: ws.baselineMeta,
});

// Rebuilds a workspace from a stored snapshot; anything malformed is rejected
// (returns null) rather than trusted.
export const restore = (raw) => {
  try {
    if (!raw || raw.v !== 2 || !Array.isArray(raw.nodes)) return null;
    const { nodes } = validateWorkspace({ files: raw.nodes });
    const ids = new Set(nodes.map((node) => node.id));
    // validateWorkspace may re-id nodes with unsafe ids; keep ids stable for everything it accepted as-is.
    if (raw.nodes.some((node) => node.type === "file" && !ids.has(node.id))) return null;
    return finish({
      projectId: typeof raw.projectId === "string" ? raw.projectId : null,
      serverUpdatedAt: typeof raw.serverUpdatedAt === "string" ? raw.serverUpdatedAt : null,
      name: typeof raw.name === "string" && raw.name ? raw.name.slice(0, 100) : "Untitled playground",
      language: typeof raw.language === "string" ? raw.language : "web",
      nodes,
      entryId: raw.entryId,
      openIds: Array.isArray(raw.openIds) ? raw.openIds : [],
      activeId: raw.activeId,
      expanded: Array.isArray(raw.expanded) ? raw.expanded.filter((id) => ids.has(id)) : expandAll(nodes),
      baseline: raw.baseline && typeof raw.baseline === "object" ? raw.baseline : {},
      baselineMeta: raw.baselineMeta && typeof raw.baselineMeta === "object" ? raw.baselineMeta : null,
    });
  } catch {
    return null;
  }
};
