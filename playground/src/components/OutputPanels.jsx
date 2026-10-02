import { History, ListChecks, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { languages } from "../workspace/languages.js";

const timeAgo = (iso) => {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
};

export function HistoryPanel({ history, limit, onOpen }) {
  if (history.length === 0) {
    return (
      <div className="pg-empty"><History size={30} aria-hidden="true" /><p>No runs yet.</p><small>Your last {limit} runs are kept on this device.</small></div>
    );
  }
  return (
    <ul className="pg-history">
      {history.map((entry) => (
        <li key={entry.id}>
          <button type="button" onClick={() => onOpen(entry)}>
            <span className={`dot ${entry.ok ? "ok" : "bad"}`} aria-hidden="true" />
            <strong>{languages.find((item) => item.id === entry.language)?.label || entry.language}{entry.entry ? ` · ${entry.entry}` : ""}</strong>
            <span className="meta">{entry.status}{entry.time !== null && entry.time !== undefined ? ` · ${entry.time} ms` : ""}</span>
            <time>{timeAgo(entry.at)}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Test cases: run the whole project once per case with `input` as stdin and
// compare the program's output with `expected`.
export function TestsPanel({ isWeb, cases, results, running, onAdd, onEdit, onRemove, onRun }) {
  if (isWeb) {
    return (
      <div className="pg-empty"><ListChecks size={30} aria-hidden="true" /><p>Tests are for programs that read stdin and print output.</p><small>Pick a language such as Python, Java or C++.</small></div>
    );
  }
  const passed = cases.filter((item) => results[item.id]?.state === "pass").length;
  return (
    <>
      <div className="pg-tests-bar">
        <button type="button" className="pg-btn" onClick={onAdd}><Plus size={14} /> Add case</button>
        <button type="button" className="pg-run small" onClick={onRun} disabled={running || cases.length === 0}>
          {running ? <Loader2 size={14} className="pg-spin" /> : <Play size={14} />} Run tests
        </button>
        {Object.keys(results).length > 0 && !running && <span className="pg-score">{passed}/{cases.length} passed</span>}
      </div>
      {cases.length === 0 && <p className="pg-drawer-note">Add a case: the project runs with the input on stdin and its output is compared with the expected text. Cloud runs are limited to 10 per minute.</p>}
      {cases.map((item, index) => {
        const result = results[item.id];
        return (
          <div key={item.id} className={`pg-test ${result?.state || ""}`}>
            <div className="pg-test-head">
              <strong>Case {index + 1}</strong>
              <span className="pg-test-state">{result?.state === "pass" ? "Passed" : result?.state === "fail" ? "Failed" : result?.state === "running" ? "Running…" : ""}</span>
              <button type="button" className="pg-btn icon" onClick={() => onRemove(item.id)} aria-label={`Remove case ${index + 1}`}><Trash2 size={13} /></button>
            </div>
            <label>Input<textarea rows={2} value={item.input} onChange={(event) => onEdit(item.id, "input", event.target.value)} spellCheck={false} /></label>
            <label>Expected output<textarea rows={2} value={item.expected} onChange={(event) => onEdit(item.id, "expected", event.target.value)} spellCheck={false} /></label>
            {result?.state === "fail" && result.actual !== undefined && <pre className="pg-actual">Got: {result.actual || "(no output)"}</pre>}
          </div>
        );
      })}
    </>
  );
}
