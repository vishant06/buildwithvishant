import { DiffEditor } from "@monaco-editor/react";
import { AlertTriangle, HardDrive, Pause, Play, RefreshCw, ShieldAlert, Unlink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@shared/theme/ThemeContext.jsx";
import { monacoLanguageFor } from "../workspace/languages.js";
import "./share.css";

export const STATUS_LABEL = {
  unsupported: "Not supported", disconnected: "Disconnected", permission: "Permission required", connecting: "Connecting…", preview: "Confirm connection",
  syncing: "Synchronizing…", synced: "Synced", review: "Review changes", conflict: "Conflict detected", paused: "Paused", error: "Error",
};

const time = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "never");

function Review({ item, language, onPick, onClose }) {
  const { theme } = useTheme();
  return (
    <div className="ws-overlay" style={{ zIndex: 960 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ws-modal sy-modal wide" role="dialog" aria-modal="true" aria-label={`Compare ${item.path}`}>
        <div className="ws-modal-head"><strong>{item.path}: local folder (left) vs Playground (right)</strong><button type="button" className="pg-btn icon" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        <div className="ws-modal-body">
          <div className="sy-diff">
            <DiffEditor
              original={item.local?.content ?? ""}
              modified={item.remote?.content ?? ""}
              language={monacoLanguageFor(item.path, language)}
              theme={theme === "dark" ? "vs-dark" : "light"}
              options={{ readOnly: true, renderSideBySide: true, automaticLayout: true, minimap: { enabled: false } }}
            />
          </div>
          <div className="ws-modal-actions">
            <button type="button" className="pg-btn" onClick={() => { onPick("local"); onClose(); }}>Keep Local Version</button>
            <button type="button" className="pg-run small" onClick={() => { onPick("playground"); onClose(); }}>Keep Playground Version</button>
          </div>
          <p className="ws-tip">The version you don’t keep is saved in “Recoverable copies” below.</p>
        </div>
      </div>
    </div>
  );
}

// Everything about the local-folder connection in one dialog.
export default function SyncPanel({ sync, language, onConfirm, onClose }) {
  const { state } = sync;
  const [review, setReview] = useState(null);
  const connected = !["disconnected", "unsupported", "connecting", "preview"].includes(state.status) || Boolean(state.folderName);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && !review && onClose();
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, review]);

  const askSensitive = (checked) => {
    if (!checked) return sync.setIncludeSensitive(false);
    return onConfirm({
      title: "Sync sensitive files?",
      message: "Files such as .env, private keys and credentials may contain secrets. If you allow them, they will be copied into this Playground project and saved to the server with it. They are still never shown on public links. Allow anyway?",
      confirmLabel: "Allow sensitive files",
      danger: true,
      run: () => sync.setIncludeSensitive(true),
    });
  };
  const askDisconnect = () => onConfirm({
    title: "Disconnect local folder?",
    message: `Syncing with “${state.folderName}” stops. No files are deleted on either side, and the recoverable copies kept by sync are discarded.`,
    confirmLabel: "Disconnect",
    danger: true,
    run: sync.disconnect,
  });
  const askDeleteAll = () => onConfirm({
    title: `Apply ${state.pending.length} deletion${state.pending.length === 1 ? "" : "s"}?`,
    message: `${state.massDeletion ? "That is a lot of files at once. If the folder was moved or renamed, choose “Keep all” instead. " : ""}Each deleted file is saved under “Recoverable copies” first.`,
    confirmLabel: "Delete all",
    danger: true,
    run: () => sync.resolveAllPending("delete"),
  });

  let top;
  if (state.status === "unsupported" || !sync.supported) {
    top = <div className="ws-banner"><AlertTriangle size={14} /><span>Your browser can’t give a web page access to a local folder. Use Chrome, Edge or Opera on a desktop computer (over HTTPS). Your Playground project keeps working without it.</span></div>;
  } else if (!sync.available) {
    top = <p className="ws-message">Log in and save this project to My Playground (Ctrl+S) before connecting a local folder.</p>;
  } else if (state.status === "preview" && state.preview) {
    const p = state.preview;
    top = (
      <>
        <p className="ws-message">Connect <strong>“{p.folderName}”</strong> to this project? Nothing has been changed yet.</p>
        <ul className="sy-list">
          <li>{p.toWorkspace} file{p.toWorkspace === 1 ? "" : "s"} from the folder will be added to / updated in the Playground{p.files.toWorkspace.length ? `: ${p.files.toWorkspace.join(", ")}` : ""}</li>
          <li>{p.toLocal} Playground file{p.toLocal === 1 ? "" : "s"} will be written to the folder{p.files.toLocal.length ? `: ${p.files.toLocal.join(", ")}` : ""}</li>
          <li>{p.conflicts} file{p.conflicts === 1 ? "" : "s"} exist on both sides with different content (you choose which to keep){p.files.conflicts.length ? `: ${p.files.conflicts.join(", ")}` : ""}</li>
        </ul>
        <div className="ws-modal-actions">
          <button type="button" className="pg-btn" onClick={sync.cancelPreview}>Cancel</button>
          <button type="button" className="pg-run small" onClick={sync.confirmConnect}>Start syncing</button>
        </div>
      </>
    );
  } else if (!connected) {
    top = (
      <>
        <p className="ws-message">Pick the folder on your computer that holds this project. Files stay in sync in both directions while this page is open: edit in your own editor, see it here; edit here, see it in the folder.</p>
        <div className="sy-actions"><button type="button" className="pg-run small" onClick={sync.connect}><HardDrive size={14} /> Connect Local Folder</button></div>
        <p className="ws-tip">Only the folder you choose is touched. node_modules, .git, build output, OS files, .env files and keys are never synced by default.</p>
      </>
    );
  } else {
    top = (
      <>
        <div className="sy-head"><HardDrive size={16} /><strong>{state.folderName}</strong><span className={`sy-dot ${state.status}`} /> <span>{STATUS_LABEL[state.status]}</span></div>
        <p className="ws-tip">Last synced: {time(state.lastSyncedAt)}</p>
        {state.status === "permission" && (
          <div className="ws-banner" role="alert"><ShieldAlert size={14} /><span>The browser needs your permission again to use this folder (it forgets after a reload).</span></div>
        )}
        <div className="sy-actions">
          {state.status === "permission" && <button type="button" className="pg-run small" onClick={sync.allowAccess}>Allow access</button>}
          {state.status === "paused" ? <button type="button" className="pg-btn" onClick={sync.resume}><Play size={14} /> Resume</button> : state.status !== "permission" && <button type="button" className="pg-btn" onClick={sync.pause}><Pause size={14} /> Pause</button>}
          <button type="button" className="pg-btn" onClick={sync.syncNow} disabled={["permission", "paused"].includes(state.status)}><RefreshCw size={14} /> Sync now</button>
          <button type="button" className="pg-btn" onClick={askDisconnect}><Unlink size={14} /> Disconnect</button>
        </div>
        <label className="sy-check"><input type="checkbox" checked={state.includeSensitive} onChange={(event) => askSensitive(event.target.checked)} /><span>Also sync sensitive files (.env, keys, credentials) — off by default</span></label>
      </>
    );
  }

  return (
    <div className="ws-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ws-modal sy-modal" role="dialog" aria-modal="true" aria-label="Local folder sync">
        <div className="ws-modal-head"><strong>Local folder sync</strong><button type="button" className="pg-btn icon" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        <div className="ws-modal-body">
          {top}
          {state.error && <p className="ws-error" role="alert">{state.error}</p>}

          {state.conflicts.length > 0 && (
            <div className="sy-section">
              <h4>Conflicts ({state.conflicts.length})</h4>
              <p className="ws-tip">Changed on both sides. Nothing was overwritten.</p>
              {state.conflicts.map((item) => (
                <div className="sy-item" key={item.key}>
                  <code>{item.path}{!item.local ? " (deleted locally)" : !item.remote ? " (deleted in Playground)" : ""}</code>
                  <span className="sy-actions">
                    <button type="button" className="pg-btn" onClick={() => sync.resolveConflict(item.key, "local")}>Keep Local</button>
                    <button type="button" className="pg-btn" onClick={() => sync.resolveConflict(item.key, "playground")}>Keep Playground</button>
                    <button type="button" className="pg-btn" onClick={() => setReview(item)}>Review Both</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {state.pending.length > 0 && (
            <div className="sy-section">
              <h4>Deletions waiting for you ({state.pending.length})</h4>
              {state.massDeletion && <div className="ws-banner" role="alert"><AlertTriangle size={14} /><span>Many files disappeared at once. If you moved or renamed the folder, choose Keep.</span></div>}
              <p className="ws-tip">Sync never deletes by itself.</p>
              {state.pending.map((item) => (
                <div className="sy-item" key={item.key}>
                  <code>{item.path} — deleted {item.deletedIn === "local" ? "in the local folder" : "in the Playground"}</code>
                  <span className="sy-actions">
                    <button type="button" className="pg-btn" onClick={() => sync.resolvePending(item.key, "keep")}>Keep file</button>
                    <button type="button" className="pg-btn" onClick={() => sync.resolvePending(item.key, "delete")}>Delete {item.deletedIn === "local" ? "here too" : "locally too"}</button>
                  </span>
                </div>
              ))}
              {state.pending.length > 1 && (
                <div className="sy-actions">
                  <button type="button" className="pg-btn" onClick={() => sync.resolveAllPending("keep")}>Keep all</button>
                  <button type="button" className="pg-btn" onClick={askDeleteAll}>Delete all…</button>
                </div>
              )}
            </div>
          )}

          {state.problems.length > 0 && <div className="sy-section"><h4>Needs attention</h4><ul className="sy-list">{state.problems.map((p) => <li key={p.path}>{p.message}</li>)}</ul></div>}

          {state.skipped.length > 0 && (
            <div className="sy-section">
              <h4>Skipped ({state.skipped.length})</h4>
              <ul className="sy-list">{state.skipped.slice(0, 50).map((s) => <li key={s.path + s.kind}><code>{s.path}</code> — {s.reason}</li>)}</ul>
            </div>
          )}

          {state.trash.length > 0 && (
            <div className="sy-section">
              <h4>Recoverable copies ({state.trash.length})</h4>
              <p className="ws-tip">Kept in this browser only, up to 40 recent copies.</p>
              {state.trash.slice(0, 20).map((item) => (
                <div className="sy-item" key={item.id}>
                  <code>{item.path} <small>({item.reason}, {new Date(item.at).toLocaleTimeString()})</small></code>
                  <span className="sy-actions">
                    <button type="button" className="pg-btn" onClick={() => sync.restoreTrash(item.id)}>Restore as copy</button>
                    <button type="button" className="pg-btn icon" onClick={() => sync.discardTrash(item.id)} aria-label="Discard copy"><X size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {state.log.length > 0 && (
            <div className="sy-section">
              <h4>Error details</h4>
              <ul className="sy-list">{state.log.slice(0, 5).map((entry) => <li key={entry.at + entry.message}>{time(entry.at)} — {entry.message}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
      {review && <Review item={review} language={language} onPick={(choice) => sync.resolveConflict(review.key, choice)} onClose={() => setReview(null)} />}
    </div>
  );
}
