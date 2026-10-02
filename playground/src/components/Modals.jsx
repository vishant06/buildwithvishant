import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import "./workspace.css";

// Small modal dialogs used by the explorer: name entry (new file / new folder /
// rename), confirmation, and "move to folder". They trap Escape/Enter and focus
// the first field.

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="ws-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ws-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ws-modal-head">
          <strong>{title}</strong>
          <button type="button" className="pg-btn icon" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// validate(value) -> error message or ""; hint(value) -> optional non-blocking tip.
export function NameModal({ title, label, initial = "", placeholder, submitLabel = "Create", validate, hint, onSubmit, onClose }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef(null);
  const error = value ? validate?.(value) || "" : "";
  const tip = !error && value ? hint?.(value) || "" : "";
  const canSubmit = Boolean(value.trim()) && !error;

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    // Rename: select the name without its extension, like a file manager.
    const dot = initial.lastIndexOf(".");
    input?.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  const submit = (event) => {
    event.preventDefault();
    if (canSubmit) onSubmit(value);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="ws-modal-body">
        <label>
          {label}
          <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} spellCheck={false} autoComplete="off" aria-invalid={Boolean(error)} />
        </label>
        {error && <p className="ws-error" role="alert">{error}</p>}
        {tip && <p className="ws-tip">{tip}</p>}
        <div className="ws-modal-actions">
          <button type="button" className="pg-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="pg-run small" disabled={!canSubmit}>{submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onClose }) {
  const buttonRef = useRef(null);
  useEffect(() => buttonRef.current?.focus(), []);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="ws-modal-body">
        <p className="ws-message">{message}</p>
        <div className="ws-modal-actions">
          <button type="button" className="pg-btn" onClick={onClose}>Cancel</button>
          <button type="button" ref={buttonRef} className={danger ? "pg-run small danger" : "pg-run small"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

export function MoveModal({ name, folders, current, onSubmit, onClose }) {
  const [dest, setDest] = useState(current);
  return (
    <Modal title={`Move "${name}"`} onClose={onClose}>
      <form className="ws-modal-body" onSubmit={(event) => { event.preventDefault(); onSubmit(dest); }}>
        <label>
          Move to folder
          <select value={dest} onChange={(event) => setDest(event.target.value)} autoFocus>
            <option value="">/ (project root)</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        </label>
        <div className="ws-modal-actions">
          <button type="button" className="pg-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="pg-run small" disabled={dest === current}>Move</button>
        </div>
      </form>
    </Modal>
  );
}
