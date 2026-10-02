import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { basename } from "@shared/workspace/core.js";

// Open files as tabs. The dot marks files changed since the last Save.
export default function EditorTabs({ files, activeId, dirtyIds, entryId, onActivate, onClose }) {
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.querySelector(".active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, files.length]);

  if (!files.length) return <div className="ws-tabs empty" />;

  return (
    <div className="ws-tabs" role="tablist" aria-label="Open files" ref={listRef}>
      {files.map((file) => {
        const dirty = dirtyIds.has(file.id);
        const name = basename(file.path);
        return (
          <div
            key={file.id}
            role="tab"
            tabIndex={0}
            aria-selected={file.id === activeId}
            className={`ws-tab${file.id === activeId ? " active" : ""}`}
            title={file.path}
            onClick={() => onActivate(file.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onActivate(file.id);
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onClose(file.id);
              }
            }}
          >
            <span className="ws-tab-name">{name}</span>
            {file.id === entryId && <span className="ws-entry-dot" title="Entry file" aria-label="Entry file" />}
            <button
              type="button"
              className={`ws-tab-close${dirty ? " dirty" : ""}`}
              aria-label={dirty ? `Close ${name} (unsaved changes)` : `Close ${name}`}
              title={dirty ? "Unsaved changes" : "Close"}
              onClick={(event) => {
                event.stopPropagation();
                onClose(file.id);
              }}
            >
              {dirty ? <span className="ws-dirty-dot" aria-hidden="true" /> : null}
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
