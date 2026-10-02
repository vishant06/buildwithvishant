import { ChevronsDownUp, FilePlus, FolderPlus, FolderTree, Upload } from "lucide-react";
import FileTree from "./FileTree.jsx";

// Left panel of the Playground: project name, quick actions and the file tree.
export default function FileExplorer({ ws, dirtyIds, onNewFile, onNewFolder, onUpload, onCollapseAll, onProjectMenu, ...treeHandlers }) {
  const hasFiles = ws.nodes.length > 0;
  return (
    <aside className="ws-explorer" aria-label="File explorer">
      <div className="ws-explorer-head">
        <span className="ws-explorer-title"><FolderTree size={14} aria-hidden="true" /> Explorer</span>
        <div className="ws-explorer-actions">
          <button type="button" className="pg-btn icon" onClick={onNewFile} title="New file (Ctrl+N / Alt+N)" aria-label="New file"><FilePlus size={15} /></button>
          <button type="button" className="pg-btn icon" onClick={onNewFolder} title="New folder (Ctrl+Shift+N / Alt+Shift+N)" aria-label="New folder"><FolderPlus size={15} /></button>
          <button type="button" className="pg-btn icon" onClick={onUpload} title="Upload files or a ZIP" aria-label="Upload files or ZIP"><Upload size={15} /></button>
          <button type="button" className="pg-btn icon" onClick={onCollapseAll} title="Collapse all folders" aria-label="Collapse all folders"><ChevronsDownUp size={15} /></button>
        </div>
      </div>

      <button
        type="button"
        className="ws-project"
        title="Project actions"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onProjectMenu(box.left + 12, box.bottom);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onProjectMenu(event.clientX, event.clientY);
        }}
      >
        <span className="ws-project-name">{ws.name || "Untitled"}</span>
        <span className="ws-project-lang">{ws.language}</span>
      </button>

      {hasFiles ? (
        <FileTree
          nodes={ws.nodes}
          expanded={ws.expanded}
          selectedId={ws.selectedId}
          activeId={ws.activeId}
          entryId={ws.entryId}
          dirtyIds={dirtyIds}
          {...treeHandlers}
        />
      ) : (
        <div className="ws-empty">
          <p>This project is empty.</p>
          <button type="button" className="pg-btn" onClick={onNewFile}><FilePlus size={14} /> New file</button>
        </div>
      )}

      <div className="ws-explorer-foot">
        <button type="button" className="pg-btn" onClick={onNewFile}><FilePlus size={14} /> New File</button>
        <button type="button" className="pg-btn" onClick={onNewFolder}><FolderPlus size={14} /> New Folder</button>
      </div>
    </aside>
  );
}
