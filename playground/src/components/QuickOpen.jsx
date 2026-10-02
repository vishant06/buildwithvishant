import { CornerDownLeft, File, Search, Terminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { basename } from "@shared/workspace/core.js";

const MAX_RESULTS = 30;

// Subsequence match: every character of the query appears in order. Lower score is better.
const fuzzy = (query, text) => {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) return at + (t.length - q.length) * 0.01;
  let pos = 0;
  let score = 50;
  for (const ch of q) {
    pos = t.indexOf(ch, pos);
    if (pos < 0) return Infinity;
    score += pos;
    pos += 1;
  }
  return score;
};

// Ctrl/Cmd+P: open a file by (part of) its path. Start with ">" to run a command
// (Ctrl/Cmd+Shift+P). With 3+ characters it also lists matching lines inside files.
export default function QuickOpen({ files, commands, initial = "", onOpenFile, onClose }) {
  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const commandMode = query.startsWith(">");

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const results = useMemo(() => {
    if (commandMode) {
      const term = query.slice(1).trim();
      return commands
        .map((command) => ({ command, score: term ? fuzzy(term, command.label) : 0 }))
        .filter((item) => item.score !== Infinity)
        .sort((a, b) => a.score - b.score)
        .map(({ command }) => ({ kind: "command", key: command.label, label: command.label, hint: command.shortcut, command }));
    }
    const term = query.trim();
    const byName = files
      .map((file) => ({ file, score: term ? Math.min(fuzzy(term, basename(file.path)), fuzzy(term, file.path) + 5) : 0 }))
      .filter((item) => item.score !== Infinity)
      .sort((a, b) => a.score - b.score || a.file.path.localeCompare(b.file.path))
      .slice(0, MAX_RESULTS)
      .map(({ file }) => ({ kind: "file", key: `f${file.id}`, label: basename(file.path), hint: file.path, file }));
    if (term.length < 3) return byName;
    const needle = term.toLowerCase();
    const inFiles = [];
    for (const file of files) {
      const lines = (file.content || "").split("\n");
      for (let i = 0; i < lines.length && inFiles.length < 15; i += 1) {
        if (lines[i].toLowerCase().includes(needle)) {
          inFiles.push({ kind: "line", key: `l${file.id}:${i}`, label: lines[i].trim().slice(0, 90), hint: `${file.path}:${i + 1}`, file, line: i + 1 });
        }
      }
    }
    return [...byName, ...inFiles];
  }, [query, commandMode, files, commands]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }), [active, results]);

  const choose = (item) => {
    onClose();
    if (item.kind === "command") item.command.run();
    else onOpenFile(item.file.id, item.line);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length) setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[active]) choose(results[active]);
    }
  };

  return (
    <div className="ws-overlay top" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ws-quick" role="dialog" aria-modal="true" aria-label="Quick open" onKeyDown={onKeyDown}>
        <div className="ws-quick-input">
          {commandMode ? <Terminal size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Go to file…   (type > for commands)" spellCheck={false} autoComplete="off" aria-label="Quick open" />
        </div>
        <div className="ws-quick-list" role="listbox" ref={listRef}>
          {results.length === 0 && <p className="ws-quick-empty">{commandMode ? "No matching commands." : "No matching files."}</p>}
          {results.map((item, index) => (
            <button key={item.key} type="button" role="option" aria-selected={index === active} className={index === active ? "active" : ""} onMouseMove={() => setActive(index)} onClick={() => choose(item)}>
              {item.kind === "command" ? <Terminal size={14} /> : <File size={14} />}
              <span className="label">{item.label}</span>
              <span className="hint">{item.hint}</span>
              {index === active && <CornerDownLeft size={13} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
