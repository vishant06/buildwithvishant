import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { extname } from "@shared/workspace/core.js";
import { buildTree } from "../workspace/tree.js";

const CODE_EXTENSIONS = new Set([".java", ".py", ".js", ".mjs", ".cjs", ".ts", ".c", ".cpp", ".cc", ".h", ".hpp", ".cs", ".go", ".rs", ".rb", ".php", ".kt", ".swift", ".dart", ".html", ".css", ".sh", ".lua", ".pl", ".r", ".scala", ".hs", ".sql"]);

const iconFor = (node, open) => {
  if (node.type === "folder") return open ? FolderOpen : Folder;
  const ext = extname(node.name);
  if (ext === ".json") return FileJson;
  if (ext === ".md" || ext === ".txt") return FileText;
  return CODE_EXTENSIONS.has(ext) ? FileCode : File;
};

// Flattened list of what is visible (for keyboard navigation).
const visibleRows = (tree, expanded, depth = 0, out = []) => {
  for (const node of tree) {
    out.push({ node, depth });
    if (node.type === "folder" && expanded.has(node.id)) visibleRows(node.children, expanded, depth + 1, out);
  }
  return out;
};

// The explorer tree. Folders first, A-Z. Supports click/double-click, arrow keys,
// F2 / Delete (only while the tree has focus), right-click menus and drag-and-drop moves.
export default function FileTree({
  nodes,
  expanded,
  selectedId,
  activeId,
  entryId,
  dirtyIds,
  onSelect,
  onOpen,
  onToggle,
  onContextMenu,
  onRename,
  onDelete,
  onMove,
}) {
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null); // folder id, or "root"
  const expandedSet = new Set(expanded);
  const rows = visibleRows(buildTree(nodes), expandedSet);

  const onKeyDown = (event) => {
    const index = rows.findIndex((row) => row.node.id === selectedId);
    const current = rows[index]?.node;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
      if (next) onSelect(next.node.id);
    } else if (event.key === "ArrowRight" && current?.type === "folder" && !expandedSet.has(current.id)) {
      event.preventDefault();
      onToggle(current.id);
    } else if (event.key === "ArrowLeft" && current?.type === "folder" && expandedSet.has(current.id)) {
      event.preventDefault();
      onToggle(current.id);
    } else if (event.key === "Enter" && current) {
      event.preventDefault();
      if (current.type === "folder") onToggle(current.id);
      else onOpen(current.id);
    } else if (event.key === "F2" && current) {
      event.preventDefault();
      onRename(current.id);
    } else if (event.key === "Delete" && current) {
      event.preventDefault();
      onDelete(current.id);
    } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      if (!current) return;
      event.preventDefault();
      const box = event.currentTarget.querySelector(`[data-id="${current.id}"]`)?.getBoundingClientRect();
      onContextMenu(current.id, (box?.left || 0) + 24, (box?.bottom || 0));
    }
  };

  const drop = (event, targetFolderId) => {
    event.preventDefault();
    event.stopPropagation();
    const id = dragId;
    setDragId(null);
    setDropId(null);
    if (id) onMove(id, targetFolderId === "root" ? "" : targetFolderId);
  };

  return (
    <div
      className={`ws-tree${dropId === "root" ? " drop-root" : ""}`}
      role="tree"
      aria-label="Project files"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        if (dragId) {
          event.preventDefault();
          setDropId("root");
        }
      }}
      onDrop={(event) => drop(event, "root")}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onContextMenu("root", event.clientX, event.clientY);
        }
      }}
    >
      {rows.map(({ node, depth }) => {
        const open = node.type === "folder" && expandedSet.has(node.id);
        const Icon = iconFor(node, open);
        const dirty = node.type === "file" && dirtyIds.has(node.id);
        return (
          <div
            key={node.id}
            data-id={node.id}
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={node.id === selectedId}
            aria-expanded={node.type === "folder" ? open : undefined}
            className={`ws-row${node.id === selectedId ? " selected" : ""}${node.id === activeId ? " active" : ""}${dropId === node.id ? " drop" : ""}${dragId === node.id ? " dragging" : ""}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            draggable
            onClick={() => {
              onSelect(node.id);
              if (node.type === "folder") onToggle(node.id);
              else onOpen(node.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(node.id);
              onContextMenu(node.id, event.clientX, event.clientY);
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", node.path);
              setDragId(node.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropId(null);
            }}
            onDragOver={(event) => {
              if (!dragId || dragId === node.id) return;
              event.preventDefault();
              event.stopPropagation();
              setDropId(node.type === "folder" ? node.id : "root");
            }}
            onDrop={(event) => drop(event, node.type === "folder" ? node.id : "root")}
          >
            <span className="ws-chevron" aria-hidden="true">
              {node.type === "folder" ? open ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
            </span>
            <Icon size={15} className={`ws-icon ${node.type}`} aria-hidden="true" />
            <span className="ws-name">{node.name}</span>
            {node.id === entryId && <span className="ws-badge" title="Entry file: Run starts here">entry</span>}
            {dirty && <span className="ws-dirty-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
          </div>
        );
      })}
    </div>
  );
}
