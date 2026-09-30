import Editor from "@monaco-editor/react";
import {
  Check,
  Cloud,
  Clock,
  Copy,
  Download,
  FolderOpen,
  History,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Terminal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";
import request from "@shared/api/request.js";
import { useAuth } from "@shared/auth/AuthContext.jsx";
import { MAIN_SITE_URL } from "@shared/config/urls.js";
import { useTheme } from "@shared/theme/ThemeContext.jsx";
import ResizeHandle from "../components/ResizeHandle.jsx";
import useIsDesktopLayout from "../hooks/useIsDesktopLayout.js";
import useResizableSplit from "../hooks/useResizableSplit.js";
import "./playground.css";

// Panel sizing for the resizable IDE layout. Minimums are in px and enforced
// by useResizableSplit; defaults are percentages of the container.
const MIN_EDITOR_WIDTH = 320;
const MIN_OUTPUT_WIDTH = 280;
const MIN_TOP_HEIGHT = 120;
const MIN_BOTTOM_HEIGHT = 84;
const HANDLE_SIZE = 8;
const DEFAULT_SPLIT_X = 62; // editor vs output column
const DEFAULT_SPLIT_Y = 68; // output/preview vs stdin/console within the output column

const DRAFT_KEY = "playground_draft";
const HISTORY_KEY = "playground_history";
const TESTS_KEY = "playground_tests";
const FONT_KEY = "playground_font_size";
const HISTORY_LIMIT = 20;
const MIN_FONT = 11;
const MAX_FONT = 24;

// Quick-pick languages shown in the left rail (the toolbar dropdown lists all).
const RAIL = [
  { id: "web", tag: "H5", label: "HTML / CSS / JS", tone: "h5" },
  { id: "javascript", tag: "JS", label: "JavaScript", tone: "js" },
  { id: "typescript", tag: "TS", label: "TypeScript", tone: "ts" },
  { id: "python", tag: "Py", label: "Python", tone: "py" },
  { id: "java", tag: "Jv", label: "Java", tone: "jv" },
  { id: "cpp", tag: "C++", label: "C++", tone: "cpp" },
  { id: "c", tag: "C", label: "C", tone: "c" },
];

const initial = {
  html: "<main>\n  <h1>Hello, builder!</h1>\n  <p>Make something delightful.</p>\n</main>",
  css: "body { font-family: system-ui; padding: 2rem; color: #0f172a; }\nh1 { color: #0284c7; }",
  javascript: 'console.log("Ready to build");',
};


const languages = [
  { id: "web", label: "HTML / CSS / JS" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "dart", label: "Dart" },
  { id: "r", label: "R" },
  { id: "scala", label: "Scala" },
  { id: "shell", label: "Bash / Shell" },
  { id: "sql", label: "SQL" },
  { id: "lua", label: "Lua" },
  { id: "perl", label: "Perl" },
  { id: "haskell", label: "Haskell" },
];
const editorLanguage = {
  html: "html",
  css: "css",
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  c: "c",
  cpp: "cpp",
  java: "java",
  csharp: "csharp",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  kotlin: "kotlin",
  swift: "swift",
  dart: "dart",
  r: "r",
  scala: "scala",
  shell: "shell",
  sql: "sql",
  lua: "lua",
  perl: "perl",
  haskell: "haskell",
};
const demos = {
  javascript:
    "const numbers = [1, 2, 3, 4, 5];\nconsole.log(numbers);\nconsole.log(numbers.reduce((sum, value) => sum + value, 0));",
  typescript:
    'interface User { name: string; age: number; }\nconst user: User = { name: "Vishant", age: 20 };\nconsole.log(user.name + " is " + user.age);',
  python:
    'name = "Vishant"\nfor i in range(5):\n    print(f"Hello {name} - {i}")',
  c: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello from C!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from C++!" << endl;\n  return 0;\n}',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java!");\n  }\n}',
  csharp:
    'using System;\n\nclass MainClass {\n  static void Main() {\n    Console.WriteLine("Hello from C#!");\n  }\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello from Go!")\n}',
  rust: 'fn main() {\n  println!("Hello from Rust!");\n}',
  ruby: 'puts "Hello from Ruby!"',
  php: '<?php\necho "Hello from PHP!\\n";',
  kotlin: 'fun main() {\n  println("Hello from Kotlin!")\n}',
  swift: 'print("Hello from Swift!")',
  dart: 'void main() {\n  print("Hello from Dart!");\n}',
  r: 'print("Hello from R!")',
  scala: 'object Main extends App {\n  println("Hello from Scala!")\n}',
  shell: '#!/usr/bin/env bash\necho "Hello from Bash!"',
  sql: 'CREATE TABLE students (name TEXT, score INTEGER);\nINSERT INTO students VALUES ("Vishant", 100);\nSELECT * FROM students;',
  lua: 'print("Hello from Lua!")',
  perl: 'print "Hello from Perl!\\n";',
  haskell: 'main :: IO ()\nmain = putStrLn "Hello from Haskell!"',
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — persistence is best-effort.
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);

// Turns the /playground/execute response into console lines (same rules as before).
const toLines = (result) => {
  const output = [result.stdout, result.compileOutput, result.stderr, result.message].filter(Boolean);
  const type = result.success ? "success" : "error";
  if (output.length) return output.map((text) => ({ type, text }));
  return [{ type, text: result.success ? "Execution completed with no output." : result.status }];
};

const timeAgo = (iso) => {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
};

const Playground = forwardRef(function Playground(_props, ref) {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  // Restored once, up front, so the saved draft is never overwritten by the
  // initial state before it has been read.
  const draft = useMemo(() => readJson(DRAFT_KEY, {}), []);

  const [code, setCode] = useState(draft.code || initial);
  const [language, setLanguage] = useState(draft.language || "web");
  const [file, setFile] = useState(draft.file || "html");
  const [singleCode, setSingleCode] = useState(draft.singleCode || "");
  const [title, setTitle] = useState(draft.title || "Untitled playground");
  const [stdin, setStdin] = useState(draft.stdin || "");
  const [projectId, setProjectId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [runVersion, setRunVersion] = useState(0);
  const [consoleLines, setConsoleLines] = useState([{ type: "info", text: "Ready. Press Run to execute your code." }]);
  const [running, setRunning] = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  const [status, setStatus] = useState("");
  const [runMs, setRunMs] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("output");
  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, []));
  const [tests, setTests] = useState(() => readJson(TESTS_KEY, {}));
  const [testResults, setTestResults] = useState({});
  const [testsRunning, setTestsRunning] = useState(false);
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem(FONT_KEY)) || 14);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isDesktopLayout = useIsDesktopLayout();
  const bodyRef = useRef(null); // flex row: [editor] [handle] [output]
  const outputColumnRef = useRef(null); // flex column: [top] [handle] [bottom]
  const editorPanelRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const previewFrameRef = useRef(null);
  const abortRef = useRef(null);

  const isWeb = language === "web";
  const currentCode = isWeb ? code[file] : singleCode;
  const languageLabel = languages.find((item) => item.id === language)?.label || language;
  const currentTests = tests[language] || [];

  // The preview <iframe> is its own browsing context and does not reliably
  // notice its container being resized by a JS-driven drag. Toggling
  // `display` forces a fresh layout and clears the stale size.
  const forcePreviewReflow = () => {
    const frame = previewFrameRef.current;
    if (!frame) return;
    frame.style.display = "none";
    // eslint-disable-next-line no-unused-expressions
    frame.offsetHeight;
    frame.style.display = "";
  };

  const splitX = useResizableSplit({
    containerRef: bodyRef,
    axis: "x",
    min1: MIN_EDITOR_WIDTH,
    min2: MIN_OUTPUT_WIDTH,
    handleSize: HANDLE_SIZE,
    defaultRatio: DEFAULT_SPLIT_X,
    storageKey: "playground_split_x",
    enabled: isDesktopLayout,
    onSettle: forcePreviewReflow,
  });
  const splitY = useResizableSplit({
    containerRef: outputColumnRef,
    axis: "y",
    min1: MIN_TOP_HEIGHT,
    min2: MIN_BOTTOM_HEIGHT,
    handleSize: HANDLE_SIZE,
    defaultRatio: DEFAULT_SPLIT_Y,
    storageKey: "playground_split_y",
    enabled: isDesktopLayout,
    onSettle: forcePreviewReflow,
  });

  // Monaco must re-measure whenever its container changes size (drag, window
  // resize, fullscreen). useLayoutEffect closes the "painted before layout
  // settled" window on the first mount.
  useLayoutEffect(() => {
    const container = editorPanelRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => editorInstanceRef.current?.layout());
    observer.observe(container);
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => editorInstanceRef.current?.layout());
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, []);

  const srcDoc = useMemo(() => {
    const bridge =
      '<script>const send=(type,args)=>parent.postMessage({source:"vk-playground",type,text:args.map(a=>typeof a==="string"?a:JSON.stringify(a)).join(" ")},"*");["log","info","warn","error"].forEach(type=>{const original=console[type];console[type]=(...args)=>{send(type,args);original(...args)}});window.onerror=(message)=>send("error",[message]);<\\/script>';
    const userScript = code.javascript.replace(/<\/script/gi, "<\\/script");
    return (
      "<!doctype html><html><head><style>" +
      code.css +
      "</style></head><body>" +
      code.html +
      bridge +
      "<script>" +
      userScript +
      "<\\/script></body></html>"
    );
  }, [code]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSaved([]);
      return;
    }
    request("/playground/my")
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [isAuthenticated]);

  useEffect(() => {
    const listener = (event) => {
      if (event.data?.source === "vk-playground")
        setConsoleLines((lines) => [...lines, { type: event.data.type, text: event.data.text }]);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    writeJson(DRAFT_KEY, { code, language, file, singleCode, title, stdin });
  }, [code, language, file, singleCode, title, stdin]);

  useEffect(() => {
    writeJson(TESTS_KEY, tests);
  }, [tests]);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (livePreview && isWeb) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, livePreview]);

  // Ctrl/⌘+Enter runs, Ctrl/⌘+S saves. (Ctrl+K belongs to global search.)
  useEffect(() => {
    const shortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        run();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useImperativeHandle(ref, () => ({ openSaved: () => setSavedOpen(true) }));

  const selectLanguage = (next) => {
    setLanguage(next);
    setFile(next === "web" ? "html" : next);
    setSingleCode(demos[next] || "");
    setProjectId(null);
    setStatus("");
    setRunMs(null);
    setTab("output");
  };

  const pushHistory = (entry) => {
    setHistory((items) => {
      const next = [entry, ...items].slice(0, HISTORY_LIMIT);
      writeJson(HISTORY_KEY, next);
      return next;
    });
  };

  const run = async () => {
    if (running) return;
    setTab("output");
    if (isWeb) {
      setConsoleLines([{ type: "info", text: "Preview refreshed." }]);
      setRunVersion((version) => version + 1);
      setStatus("Running in a sandboxed browser preview.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setConsoleLines([{ type: "info", text: "Compiling and running in the sandbox…" }]);
    setStatus("Running…");
    try {
      const result = await request("/playground/execute", {
        method: "POST",
        body: JSON.stringify({ language, code: singleCode, stdin }),
        signal: controller.signal,
      });
      const lines = toLines(result);
      const label = result.success ? "Success" : result.status || "Execution error";
      setConsoleLines(lines);
      setRunMs(result.time ?? null);
      setStatus(label + (result.time !== null && result.time !== undefined ? " · " + result.time + " ms" : ""));
      pushHistory({
        id: uid(),
        language,
        at: new Date().toISOString(),
        ok: Boolean(result.success),
        status: label,
        time: result.time ?? null,
        code: singleCode.slice(0, 20000),
        stdin: stdin.slice(0, 2000),
        lines: lines.slice(0, 200),
      });
    } catch (error) {
      if (error.name === "AbortError") {
        setConsoleLines([{ type: "info", text: "Execution stopped." }]);
        setStatus("Stopped.");
      } else {
        setConsoleLines([{ type: "error", text: error.message }]);
        setStatus("Execution failed.");
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  // Stop cancels the in-flight request. Web previews run in the browser, so
  // Stop there reloads the sandboxed frame, which halts any running script.
  const stop = () => {
    if (abortRef.current) abortRef.current.abort();
    else if (isWeb) {
      setRunVersion((version) => version + 1);
      setStatus("Preview stopped.");
    }
  };

  const reset = () => {
    setCode(initial);
    setSingleCode(demos[language] || "");
    setProjectId(null);
    setTitle("Untitled playground");
    setConsoleLines([{ type: "info", text: "Editor reset to the demo." }]);
    setStatus("");
  };

  const save = async () => {
    if (!isAuthenticated) return setStatus("Please login to save your playground.");
    const payload = { title, language, code: isWeb ? "" : singleCode, ...code };
    try {
      const result = projectId
        ? await request("/playground/" + projectId, { method: "PUT", body: JSON.stringify(payload) })
        : await request("/playground", { method: "POST", body: JSON.stringify(payload) });
      setProjectId(result._id);
      setSaved((items) => [result, ...items.filter((item) => item._id !== result._id)]);
      setStatus("Saved to My Playground.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  const openProject = (project) => {
    setProjectId(project._id);
    setTitle(project.title);
    setLanguage(project.language || "web");
    setCode({ html: project.html || "", css: project.css || "", javascript: project.javascript || "" });
    setSingleCode(project.code || "");
    setFile(project.language === "web" || !project.language ? "html" : project.language);
    setStatus("Opened " + project.title + ".");
    setSavedOpen(false);
  };

  const removeProject = async (id) => {
    try {
      await request("/playground/" + id, { method: "DELETE" });
      setSaved((items) => items.filter((item) => item._id !== id));
      if (projectId === id) setProjectId(null);
      setStatus("Saved project deleted.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {
      setStatus("Copy is blocked by the browser.");
    }
  };

  const download = () => {
    const content = isWeb
      ? "<!doctype html>\n<html><head><style>\n" + code.css + "\n</style></head><body>\n" + code.html + "\n<script>\n" + code.javascript + "\n<\\/script></body></html>"
      : singleCode;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (title.replace(/[^a-z0-9-_]/gi, "-") || "playground") + "." + (isWeb ? "html" : language);
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen unavailable (some mobile browsers / iframes) — the app already fills the viewport.
    }
  };

  const editorCommand = (name) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    editor.focus();
    editor.trigger("toolbar", name, null);
  };

  const clearOutput = () => {
    if (tab === "history") {
      setHistory([]);
      writeJson(HISTORY_KEY, []);
    } else if (tab === "tests") {
      setTestResults({});
    } else {
      setConsoleLines([]);
    }
  };

  const openHistory = (entry) => {
    if (entry.language !== "web") {
      setLanguage(entry.language);
      setFile(entry.language);
      setSingleCode(entry.code || "");
      setStdin(entry.stdin || "");
      setProjectId(null);
    }
    setConsoleLines(entry.lines || []);
    setRunMs(entry.time);
    setStatus(entry.status);
    setTab("output");
  };

  // --- Tests: each case runs the current program with `input` as stdin and
  // compares trimmed stdout to `expected`. Uses the same execute endpoint
  // (rate-limited server-side), one case at a time.
  const updateTests = (next) => setTests((all) => ({ ...all, [language]: next }));
  const addTest = () => updateTests([...currentTests, { id: uid(), input: "", expected: "" }]);
  const editTest = (id, field, value) =>
    updateTests(currentTests.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  const removeTest = (id) => updateTests(currentTests.filter((item) => item.id !== id));

  const runTests = async () => {
    if (testsRunning || isWeb || currentTests.length === 0) return;
    setTestsRunning(true);
    setTestResults({});
    for (const item of currentTests) {
      setTestResults((all) => ({ ...all, [item.id]: { state: "running" } }));
      try {
        const result = await request("/playground/execute", {
          method: "POST",
          body: JSON.stringify({ language, code: singleCode, stdin: item.input }),
        });
        const actual = String(result.stdout || "").trim();
        const pass = Boolean(result.success) && actual === item.expected.trim();
        setTestResults((all) => ({
          ...all,
          [item.id]: { state: pass ? "pass" : "fail", actual: actual || result.stderr || result.compileOutput || result.message || result.status || "" },
        }));
      } catch (error) {
        setTestResults((all) => ({ ...all, [item.id]: { state: "fail", actual: error.message } }));
        break;
      }
    }
    setTestsRunning(false);
  };

  const passed = currentTests.filter((item) => testResults[item.id]?.state === "pass").length;
  const ready = !running && !testsRunning;
  const topBasis = isDesktopLayout ? { flexBasis: `calc(${splitY.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined;
  const bottomBasis = isDesktopLayout ? { flexBasis: `calc(${100 - splitY.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined;

  const consolePane = (
    <div className="pg-console" role="log" aria-live="polite">
      {consoleLines.length === 0 && (
        <div className="pg-empty">
          <Terminal size={30} aria-hidden="true" />
          <p>Click <strong>Run</strong> to execute. Output appears here.</p>
          <small>{languageLabel} · {isWeb ? "Runs in your browser" : "Runs on cloud"}</small>
        </div>
      )}
      {consoleLines.map((line, index) => (
        <p className={line.type} key={line.text.slice(0, 40) + index}>{line.text}</p>
      ))}
    </div>
  );

  const stdinPane = (
    <div className="pg-stdin">
      <div className="pg-pane-label">
        <span>Input (stdin)</span>
        <small>{languageLabel} runs on a remote server — provide all input up front, one value per line.</small>
      </div>
      <textarea
        value={stdin}
        onChange={(event) => setStdin(event.target.value)}
        placeholder="Enter all input values, one per line (e.g. for scanf/cin)…"
        spellCheck={false}
        aria-label="Standard input"
      />
    </div>
  );

  return (
    <div className="pg-app">
      <aside className="pg-rail" aria-label="Languages">
        {RAIL.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pg-lang ${item.tone}${language === item.id ? " selected" : ""}`}
            onClick={() => selectLanguage(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={language === item.id}
          >
            {item.tag}
          </button>
        ))}
        <span className="pg-rail-spacer" />
        <button type="button" className={`pg-lang folder${savedOpen ? " selected" : ""}`} onClick={() => setSavedOpen((value) => !value)} title="My playgrounds" aria-label="My playgrounds" aria-pressed={savedOpen}>
          <FolderOpen size={18} />
        </button>
      </aside>

      <div className="pg-main">
        <div className="pg-toolbar" role="toolbar" aria-label="Editor actions">
          <div className="pg-group">
            <button type="button" className="pg-run" onClick={run} disabled={running} title="Run (Ctrl+Enter)">
              {running ? <Loader2 size={15} className="pg-spin" /> : <Play size={15} />}
              <span>{running ? "Running" : "Run"}</span>
            </button>
            <button type="button" className="pg-btn" onClick={stop} disabled={!running && !isWeb} title="Stop">
              <Square size={13} /> <span>Stop</span>
            </button>
            <select value={language} onChange={(event) => selectLanguage(event.target.value)} aria-label="Language" className="pg-select">
              {languages.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            {isWeb && (
              <label className="pg-live">
                <input type="checkbox" checked={livePreview} onChange={(event) => setLivePreview(event.target.checked)} /> Live
              </label>
            )}
          </div>

          <input className="pg-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Project title" />

          <div className="pg-group">
            <button type="button" className="pg-btn icon-only-md" onClick={() => editorCommand("undo")} title="Undo"><Undo2 size={15} /><span>Undo</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={() => editorCommand("redo")} title="Redo"><Redo2 size={15} /><span>Redo</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={reset} title="Reset to demo"><RotateCcw size={15} /><span>Reset</span></button>
            <span className="pg-sep" />
            <button type="button" className="pg-btn icon-only-md" onClick={copy} title="Copy code">{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? "Copied" : "Copy"}</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={save} title="Save (Ctrl+S)"><Save size={15} /><span>Save</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={download} title="Download"><Download size={15} /><span>Download</span></button>
            <span className="pg-sep" />
            <button type="button" className="pg-btn icon" onClick={() => setFontSize((size) => Math.max(MIN_FONT, size - 1))} title="Smaller text" aria-label="Smaller text"><Minus size={15} /></button>
            <button type="button" className="pg-btn icon" onClick={() => setFontSize((size) => Math.min(MAX_FONT, size + 1))} title="Larger text" aria-label="Larger text"><Plus size={15} /></button>
            <button type="button" className="pg-btn icon" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label="Toggle fullscreen" aria-pressed={isFullscreen}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        <div className="pg-body-wrap">
          {savedOpen && (
            <div className="pg-drawer" role="dialog" aria-label="My playgrounds">
              <div className="pg-drawer-head">
                <strong>My playgrounds</strong>
                <button type="button" className="pg-btn icon" onClick={() => setSavedOpen(false)} aria-label="Close"><X size={15} /></button>
              </div>
              {!isAuthenticated ? (
                <p className="pg-drawer-note">
                  <a href={`${MAIN_SITE_URL}/login?redirect=${encodeURIComponent(window.location.href)}`}>Log in</a> to save and reopen your playgrounds.
                </p>
              ) : saved.length === 0 ? (
                <p className="pg-drawer-note">No saved projects yet. Press Save (Ctrl+S).</p>
              ) : (
                <ul>
                  {saved.map((item) => (
                    <li key={item._id} className={item._id === projectId ? "current" : ""}>
                      <button type="button" onClick={() => openProject(item)}>
                        <strong>{item.title}</strong>
                        <small>{languages.find((entry) => entry.id === item.language)?.label || "HTML / CSS / JS"}</small>
                      </button>
                      <button type="button" className="pg-btn icon" onClick={() => removeProject(item._id)} aria-label={"Delete " + item.title}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div
            className={`pg-body${splitX.isDragging ? " resizing-x" : ""}${splitY.isDragging ? " resizing-y" : ""}`}
            ref={bodyRef}
          >
            <section className="pg-editor" style={isDesktopLayout ? { flexBasis: `calc(${splitX.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined}>
              <div className="pg-tabs">
                {isWeb ? (
                  ["html", "css", "javascript"].map((item) => (
                    <button key={item} type="button" className={file === item ? "active" : ""} onClick={() => setFile(item)}>
                      {item === "javascript" ? "script.js" : item === "css" ? "style.css" : "index.html"}
                    </button>
                  ))
                ) : (
                  <button type="button" className="active">{languageLabel}</button>
                )}
              </div>
              <div className="pg-editor-host" ref={editorPanelRef}>
                <Editor
                  height="100%"
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  language={editorLanguage[isWeb ? file : language] || "plaintext"}
                  value={currentCode}
                  loading={<div className="pg-empty"><Loader2 size={22} className="pg-spin" /></div>}
                  onMount={(editorInstance) => {
                    editorInstanceRef.current = editorInstance;
                    editorInstance.onDidChangeCursorPosition((event) =>
                      setCursor({ line: event.position.lineNumber, column: event.position.column }),
                    );
                  }}
                  onChange={(value) => (isWeb ? setCode({ ...code, [file]: value || "" }) : setSingleCode(value || ""))}
                  options={{
                    minimap: { enabled: isDesktopLayout },
                    fontSize,
                    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
                    fontLigatures: true,
                    lineNumbers: "on",
                    wordWrap: "on",
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              </div>
            </section>

            <ResizeHandle orientation="vertical" isDragging={splitX.isDragging} {...splitX.handleProps} />

            <section className="pg-output" style={isDesktopLayout ? { flexBasis: `calc(${100 - splitX.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined}>
              <div className="pg-output-head" role="tablist">
                <button type="button" role="tab" aria-selected={tab === "output"} className={tab === "output" ? "active" : ""} onClick={() => setTab("output")}><Terminal size={14} /> Output</button>
                <button type="button" role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
                  <History size={14} /> History {history.length > 0 && <span className="pg-count">{history.length}</span>}
                </button>
                <button type="button" role="tab" aria-selected={tab === "tests"} className={tab === "tests" ? "active" : ""} onClick={() => setTab("tests")}>
                  <ListChecks size={14} /> Tests {currentTests.length > 0 && <span className="pg-count">{currentTests.length}</span>}
                </button>
                <button type="button" className="pg-clear" onClick={clearOutput}><Trash2 size={13} /> Clear</button>
              </div>

              {tab === "output" && (
                <div className="pg-output-stack" ref={outputColumnRef}>
                  {isWeb ? (
                    <>
                      <div className="pg-top" style={topBasis}>
                        <iframe ref={previewFrameRef} key={runVersion} title="Playground preview" sandbox="allow-scripts" srcDoc={srcDoc} />
                      </div>
                      <ResizeHandle orientation="horizontal" isDragging={splitY.isDragging} {...splitY.handleProps} />
                      <div className="pg-bottom" style={bottomBasis}>
                        <div className="pg-pane-label"><span>Console</span></div>
                        {consolePane}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pg-top" style={topBasis}>{consolePane}</div>
                      <ResizeHandle orientation="horizontal" isDragging={splitY.isDragging} {...splitY.handleProps} />
                      <div className="pg-bottom" style={bottomBasis}>{stdinPane}</div>
                    </>
                  )}
                </div>
              )}

              {tab === "history" && (
                <div className="pg-scroll">
                  {history.length === 0 ? (
                    <div className="pg-empty"><History size={30} aria-hidden="true" /><p>No runs yet.</p><small>Your last {HISTORY_LIMIT} runs are kept on this device.</small></div>
                  ) : (
                    <ul className="pg-history">
                      {history.map((entry) => (
                        <li key={entry.id}>
                          <button type="button" onClick={() => openHistory(entry)}>
                            <span className={`dot ${entry.ok ? "ok" : "bad"}`} aria-hidden="true" />
                            <strong>{languages.find((item) => item.id === entry.language)?.label || entry.language}</strong>
                            <span className="meta">{entry.status}{entry.time !== null && entry.time !== undefined ? ` · ${entry.time} ms` : ""}</span>
                            <time>{timeAgo(entry.at)}</time>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === "tests" && (
                <div className="pg-scroll pg-tests">
                  {isWeb ? (
                    <div className="pg-empty"><ListChecks size={30} aria-hidden="true" /><p>Tests are for programs that read stdin and print output.</p><small>Pick a language such as Python, Java or C++.</small></div>
                  ) : (
                    <>
                      <div className="pg-tests-bar">
                        <button type="button" className="pg-btn" onClick={addTest}><Plus size={14} /> Add case</button>
                        <button type="button" className="pg-run small" onClick={runTests} disabled={testsRunning || currentTests.length === 0}>
                          {testsRunning ? <Loader2 size={14} className="pg-spin" /> : <Play size={14} />} Run tests
                        </button>
                        {Object.keys(testResults).length > 0 && !testsRunning && <span className="pg-score">{passed}/{currentTests.length} passed</span>}
                      </div>
                      {currentTests.length === 0 && <p className="pg-drawer-note">Add a case: the program runs with the input on stdin and its output is compared with the expected text. Cloud runs are limited to 10 per minute.</p>}
                      {currentTests.map((item, index) => {
                        const result = testResults[item.id];
                        return (
                          <div key={item.id} className={`pg-test ${result?.state || ""}`}>
                            <div className="pg-test-head">
                              <strong>Case {index + 1}</strong>
                              <span className="pg-test-state">{result?.state === "pass" ? "Passed" : result?.state === "fail" ? "Failed" : result?.state === "running" ? "Running…" : ""}</span>
                              <button type="button" className="pg-btn icon" onClick={() => removeTest(item.id)} aria-label={`Remove case ${index + 1}`}><Trash2 size={13} /></button>
                            </div>
                            <label>Input<textarea rows={2} value={item.input} onChange={(event) => editTest(item.id, "input", event.target.value)} spellCheck={false} /></label>
                            <label>Expected output<textarea rows={2} value={item.expected} onChange={(event) => editTest(item.id, "expected", event.target.value)} spellCheck={false} /></label>
                            {result?.state === "fail" && result.actual !== undefined && <pre className="pg-actual">Got: {result.actual || "(no output)"}</pre>}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="pg-status">
          <span className="pg-ready"><span className={`dot ${ready ? "ok" : "busy"}`} aria-hidden="true" /> {status || (ready ? `Ready · ${languageLabel} ${isWeb ? "runs in browser" : "runs in cloud"}` : "Working…")}</span>
          <span className="pg-status-right">
            <span className="pg-chip"><Cloud size={12} /> {isWeb ? "Local" : "Cloud"}</span>
            <span className="pg-chip"><Clock size={12} /> {runMs === null ? "-- ms" : `${runMs} ms`}</span>
            <span className="pg-chip">Ln {cursor.line}, Col {cursor.column}</span>
          </span>
        </footer>
      </div>
    </div>
  );
});

export default Playground;
