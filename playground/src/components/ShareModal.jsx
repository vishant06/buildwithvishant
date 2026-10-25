import { AlertTriangle, Check, Copy, ExternalLink, Globe, Lock, RefreshCw, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isHiddenFromPublic, scanSecrets } from "@shared/workspace/rules.js";
import "./share.css";

const ROLES = [
  { id: "viewer", label: "Viewer", help: "can view and run, not change" },
  { id: "editor", label: "Editor", help: "can edit and save files" },
  { id: "manager", label: "Full access", help: "can edit, share and manage people (not delete)" },
];

// People with access: add by email or username, choose what they may do, change or remove later.
// Every rule is enforced by the server; this only asks for changes.
function People({ project, role, api }) {
  const [state, setState] = useState({ loading: true, members: [], error: "" });
  const [identifier, setIdentifier] = useState("");
  const [newRole, setNewRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const roles = role === "owner" ? ROLES : ROLES.filter((item) => item.id !== "manager");

  const load = () =>
    api(`/playground/${project._id}/members`)
      .then((data) => setState({ loading: false, members: data.members, max: data.max, error: "" }))
      .catch((err) => setState({ loading: false, members: [], error: err.message }));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project._id]);

  const run = async (work) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const add = (event) => {
    event.preventDefault();
    if (!identifier.trim()) return;
    run(async () => {
      await api(`/playground/${project._id}/members`, { method: "POST", body: JSON.stringify({ identifier: identifier.trim(), role: newRole }) });
      setIdentifier("");
    });
  };
  const canTouch = (member) => role === "owner" || member.role !== "manager";

  return (
    <div className="sh-people">
      <h4>People with access</h4>
      <form className="sh-add" onSubmit={add}>
        <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or username" aria-label="Email or username" maxLength={120} autoComplete="off" />
        <select value={newRole} onChange={(event) => setNewRole(event.target.value)} aria-label="Access level">
          {roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <button type="submit" className="pg-run small" disabled={busy || !identifier.trim()}><UserPlus size={14} /> Add</button>
      </form>
      <p className="sh-role-help">{roles.map((item) => `${item.label}: ${item.help}`).join(" · ")}. Only people with a BuildWithVishant account can be added.</p>
      {state.loading ? <p className="ws-tip">Loading…</p> : state.members.length === 0 ? <p className="ws-tip">Only you can open this project right now.</p> : state.members.map((member) => (
        <div className="sh-person" key={member.userId}>
          <span className="who">{member.name || member.username}<small>@{member.username}</small></span>
          {canTouch(member) ? (
            <select value={member.role} disabled={busy} aria-label={`Access for ${member.username}`} onChange={(event) => run(() => api(`/playground/${project._id}/members/${member.userId}`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) }))}>
              {(role === "owner" ? ROLES : ROLES.filter((item) => item.id !== "manager")).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          ) : <span className="ws-tip">Full access</span>}
          {canTouch(member) && <button type="button" className="pg-btn icon" disabled={busy} aria-label={`Remove ${member.username}`} title="Remove access" onClick={() => run(() => api(`/playground/${project._id}/members/${member.userId}`, { method: "DELETE" }))}><X size={14} /></button>}
        </div>
      ))}
      {(error || state.error) && <p className="ws-error" role="alert">{error || state.error}</p>}
    </div>
  );
}

export const publicUrlFor = (slug) => `${window.location.origin}/p/${slug}`;

// Share / privacy dialog. All real enforcement is on the server; this only
// shows the state and asks for changes.
export default function ShareModal({ ws, project, role = "owner", api, isAuthenticated, busy, error, onChange, onClose }) {
  const canManage = role === "owner" || role === "manager";
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
  if (!canManage) {
    body = (
      <p className="ws-message">
        {role === "viewer" ? "You can view this project." : "You can edit this project."} Only the owner or someone with full access can change who else can see it.
      </p>
    );
  } else if (!isAuthenticated) body = <p className="ws-message">Log in to save this project and share it.</p>;
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
          {canManage && isAuthenticated && ws.projectId && project && <People project={project} role={role} api={api} />}
          {error && <p className="ws-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
