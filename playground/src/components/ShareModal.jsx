import { AlertTriangle, Check, Copy, ExternalLink, Globe, Lock, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isHiddenFromPublic, scanSecrets } from "@shared/workspace/rules.js";
import "./share.css";

export const publicUrlFor = (slug) => `${window.location.origin}/p/${slug}`;

// Share / privacy dialog. All real enforcement is on the server; this only
// shows the state and asks for changes.
export default function ShareModal({ ws, project, isAuthenticated, busy, error, onChange, onClose }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isPublic = project?.visibility === "public" && project?.publicSlug;
  const url = isPublic ? publicUrlFor(project.publicSlug) : "";

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Advisory scan of what a visitor would see.
  const files = ws.nodes.filter((node) => node.type === "file");
  const hidden = files.filter((node) => isHiddenFromPublic(node.path, node.content)).map((node) => node.path);
  const risky = files.filter((node) => !isHiddenFromPublic(node.path, node.content)).map((node) => ({ path: node.path, reasons: scanSecrets(node.content) })).filter((item) => item.reasons.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  let body;
  if (!isAuthenticated) body = <p className="ws-message">Log in to save this project and share it.</p>;
  else if (!ws.projectId || !project) body = <p className="ws-message">Save this project to My Playground first (Ctrl+S). Only saved projects can be shared.</p>;
  else if (!isPublic) {
    body = (
      <>
        <div className="sh-state private"><Lock size={16} /> <strong>Private</strong> <span>Only you can see this project.</span></div>
        <p className="ws-message">To share it with other people, make it public. Anyone with the link will be able to <strong>view</strong> the files (read-only). Nobody else can change them.</p>
        {confirming ? (
          <div className="sh-confirm">
            <p className="ws-message"><strong>Everything below will be visible to anyone with the link</strong>, even if they are not logged in.</p>
            {hidden.length > 0 && <p className="ws-tip"><Lock size={12} /> Not shown publicly, always: {hidden.slice(0, 5).join(", ")}{hidden.length > 5 ? "…" : ""}</p>}
            {risky.length > 0 && (
              <div className="ws-banner" role="alert">
                <AlertTriangle size={14} />
                <span>Possible secrets in: {risky.slice(0, 4).map((item) => `${item.path} (${item.reasons[0]})`).join("; ")}. Remove them first.</span>
              </div>
            )}
            <div className="ws-modal-actions">
              <button type="button" className="pg-btn" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="pg-run small" disabled={busy} onClick={() => onChange("public")}><Globe size={14} /> Make public</button>
            </div>
          </div>
        ) : (
          <div className="ws-modal-actions"><button type="button" className="pg-run small" onClick={() => setConfirming(true)}><Globe size={14} /> Make public…</button></div>
        )}
      </>
    );
  } else {
    body = (
      <>
        <div className="sh-state public"><Globe size={16} /> <strong>Public</strong> <span>Anyone with the link can view (read-only).</span></div>
        <label className="sh-link">
          Public link
          <span className="sh-row">
            <input readOnly value={url} onFocus={(event) => event.target.select()} aria-label="Public project link" />
            <button type="button" className="pg-btn" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}</button>
          </span>
        </label>
        <div className="sh-row wrap">
          <a className="pg-btn" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open read-only view</a>
          <button type="button" className="pg-btn" disabled={busy} onClick={() => onChange("public", { regenerate: true })} title="Creates a new link; the old one stops working"><RefreshCw size={14} /> New link</button>
        </div>
        {hidden.length > 0 && <p className="ws-tip"><Lock size={12} /> Never shown publicly: {hidden.slice(0, 5).join(", ")}{hidden.length > 5 ? "…" : ""}</p>}
        {risky.length > 0 && <div className="ws-banner" role="alert"><AlertTriangle size={14} /><span>Possible secrets in: {risky.slice(0, 4).map((item) => item.path).join(", ")}. They are visible to visitors.</span></div>}
        <div className="ws-modal-actions"><button type="button" className="pg-run small danger" disabled={busy} onClick={() => onChange("private")}><Lock size={14} /> Make private</button></div>
        <p className="ws-tip">Making it private stops the link working immediately, and the old link never works again.</p>
      </>
    );
  }

  return (
    <div className="ws-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ws-modal sh-modal" role="dialog" aria-modal="true" aria-label="Share project">
        <div className="ws-modal-head"><strong>Share “{ws.name}”</strong><button type="button" className="pg-btn icon" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        <div className="ws-modal-body">
          {body}
          {error && <p className="ws-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
