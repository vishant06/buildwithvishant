import Editor from "@monaco-editor/react";
import {
  Check,
  Copy,
  Download,
  Minimize2,
  Maximize2,
  Play,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ResizeHandle from "../components/ResizeHandle.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useIsDesktopLayout from "../hooks/useIsDesktopLayout.js";
import useResizableSplit from "../hooks/useResizableSplit.js";
import request from "../services/api.js";

// Panel sizing constants for the VS Code-like resizable Playground layout.
// Minimums are in px and enforced by useResizableSplit regardless of
// viewport size; defaults/ratios are percentages of their container.
const MIN_EDITOR_WIDTH = 340;
const MIN_PREVIEW_WIDTH = 260;
const MIN_EDITOR_HEIGHT = 160;
const MIN_CONSOLE_HEIGHT = 90;
const HANDLE_SIZE = 8;
const DEFAULT_SPLIT_X = 62; // editor+console column vs preview column
const DEFAULT_SPLIT_Y = 68; // editor vs console within that column

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

export default function Playground() {
  const { isAuthenticated } = useAuth();
  const [code, setCode] = useState(initial);
  const [language, setLanguage] = useState("web");
  const [file, setFile] = useState("html");
  const [singleCode, setSingleCode] = useState("");
  const [title, setTitle] = useState("Untitled playground");
  const [projectId, setProjectId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [runVersion, setRunVersion] = useState(0);
  const [consoleLines, setConsoleLines] = useState([
    { type: "info", text: "Ready. Press Run to update the preview." },
  ]);
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  // True toggle state for Fit to Screen — a plain boolean, flipped with
  // `!isFitToScreen` on every click, so it can go ON -> OFF -> ON
  // indefinitely without drifting from the real layout state.
  const [isFitToScreen, setIsFitToScreen] = useState(false);
  const shellRef = useRef(null);

  // --- Resizable layout -------------------------------------------------
  const isDesktopLayout = useIsDesktopLayout();
  const splitRowRef = useRef(null); // flex row: [left column] [vhandle] [preview]
  const leftColumnRef = useRef(null); // flex column: [editor] [hhandle] [console]
  const editorPanelRef = useRef(null); // wraps <Editor>, observed so Monaco can re-layout
  const editorInstanceRef = useRef(null);

  const splitX = useResizableSplit({
    containerRef: splitRowRef,
    axis: "x",
    min1: MIN_EDITOR_WIDTH,
    min2: MIN_PREVIEW_WIDTH,
    handleSize: HANDLE_SIZE,
    defaultRatio: DEFAULT_SPLIT_X,
    storageKey: "playground_split_x",
    enabled: isDesktopLayout,
  });
  const splitY = useResizableSplit({
    containerRef: leftColumnRef,
    axis: "y",
    min1: MIN_EDITOR_HEIGHT,
    min2: MIN_CONSOLE_HEIGHT,
    handleSize: HANDLE_SIZE,
    defaultRatio: DEFAULT_SPLIT_Y,
    storageKey: "playground_split_y",
    enabled: isDesktopLayout,
  });

  // Monaco's `automaticLayout: true` (kept below) already re-measures on a
  // timer, but that's a polling fallback, not a guarantee it happens the
  // moment a drag changes the container size. Watching the editor's own
  // wrapper with a ResizeObserver and calling `editor.layout()` directly is
  // the mechanism Monaco itself recommends for a container that resizes
  // outside of a window resize event — this fires on every drag frame and
  // on every other cause of the panel changing size (window resize,
  // fit-to-screen toggle, language switch reflow, etc.) in one place.
  useEffect(() => {
    const container = editorPanelRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      editorInstanceRef.current?.layout();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const isWeb = language === "web";
  const currentCode = isWeb ? code[file] : singleCode;
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
        setConsoleLines((lines) => [
          ...lines,
          { type: event.data.type, text: event.data.text },
        ]);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "playground_draft",
      JSON.stringify({ code, language, file, singleCode, title, stdin }),
    );
  }, [code, language, file, singleCode, title, stdin]);
  useEffect(() => {
    const draft = localStorage.getItem("playground_draft");
    if (!draft) return;
    try {
      const value = JSON.parse(draft);
      if (value.code) setCode(value.code);
      if (value.language) setLanguage(value.language);
      if (value.file) setFile(value.file);
      setSingleCode(value.singleCode || "");
      setTitle(value.title || "Untitled playground");
      setStdin(value.stdin || "");
    } catch {
      localStorage.removeItem("playground_draft");
    }
  }, []);
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
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setConsoleLines([]);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  useEffect(() => {
    if (livePreview && isWeb) run();
  }, [code, livePreview]);
  const selectLanguage = (next) => {
    setLanguage(next);
    setFile(next === "web" ? "html" : next);
    setSingleCode(demos[next] || "");
    setProjectId(null);
    setStatus("");
  };
  const run = async () => {
    if (running) return;
    if (isWeb) {
      setConsoleLines([{ type: "info", text: "Preview refreshed." }]);
      setRunVersion((version) => version + 1);
      setStatus("Running in a sandboxed browser preview.");
      return;
    }
    setRunning(true);
    setConsoleLines([
      { type: "info", text: "Compiling and running in the sandbox…" },
    ]);
    setStatus("Running…");
    try {
      const result = await request("/playground/execute", {
        method: "POST",
        body: JSON.stringify({ language, code: singleCode, stdin }),
      });
      const output = [
        result.stdout,
        result.compileOutput,
        result.stderr,
        result.message,
      ].filter(Boolean);
      setConsoleLines(
        output.length
          ? output.map((text) => ({
              type: result.success ? "success" : "error",
              text,
            }))
          : [
              {
                type: result.success ? "success" : "error",
                text: result.success
                  ? "Execution completed with no output."
                  : result.status,
              },
            ],
      );
      setStatus(
        (result.success ? "Success" : result.status || "Execution error") +
          (result.time !== null ? " · " + result.time + " ms" : ""),
      );
    } catch (error) {
      setConsoleLines([{ type: "error", text: error.message }]);
      setStatus("Execution failed.");
    } finally {
      setRunning(false);
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
    if (!isAuthenticated)
      return setStatus("Please login to save your playground.");
    const payload = { title, language, code: isWeb ? "" : singleCode, ...code };
    try {
      const result = projectId
        ? await request("/playground/" + projectId, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await request("/playground", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setProjectId(result._id);
      setSaved((items) => [
        result,
        ...items.filter((item) => item._id !== result._id),
      ]);
      setStatus("Saved to My Playground.");
    } catch (error) {
      setStatus(error.message);
    }
  };
  const openProject = (project) => {
    setProjectId(project._id);
    setTitle(project.title);
    setLanguage(project.language || "web");
    setCode({
      html: project.html || "",
      css: project.css || "",
      javascript: project.javascript || "",
    });
    setSingleCode(project.code || "");
    setFile(
      project.language === "web" || !project.language
        ? "html"
        : project.language,
    );
    setStatus("Opened " + project.title + ".");
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
  // Keeps the toggle honest if the user exits fullscreen by pressing
  // Escape (or any other way the browser allows) instead of clicking the
  // button — otherwise the button would get stuck showing "Exit Fit".
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsFitToScreen(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFitToScreen = async () => {
    const next = !isFitToScreen;

    if (next) {
      try {
        await shellRef.current?.requestFullscreen?.();
      } catch (_error) {
        // Fullscreen API unavailable/denied (some mobile browsers, some
        // iframed contexts) — fall back to the CSS-only fit-to-screen
        // layout below instead of leaving the button stuck.
      }
    } else if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (_error) {
        // Ignore — state is still flipped below.
      }
    }

    setIsFitToScreen(next);
    // Let the editor/output panels pick up the new dimensions.
    window.dispatchEvent(new Event("resize"));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  };
  const download = () => {
    const content = isWeb
      ? "<!doctype html>\n<html><head><style>\n" +
        code.css +
        "\n</style></head><body>\n" +
        code.html +
        "\n<script>\n" +
        code.javascript +
        "\n<\\/script></body></html>"
      : singleCode;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      (title.replace(/[^a-z0-9-_]/gi, "-") || "playground") +
      "." +
      (isWeb ? "html" : language);
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="playground-page">
      <div className="playground-heading">
        <div>
          <span className="eyebrow">Browser playground</span>
          <h1>Build. Run. Learn.</h1>
        </div>
        <span className={"play-status " + (isWeb ? "ready" : "")}>
          {isWeb ? "Browser runtime ready" : "Compiler not configured"}
        </span>
      </div>
      <div
        className={
          "playground-shell" +
          (isFitToScreen ? " fit-to-screen" : "") +
          (splitX.isDragging ? " resizing-x" : "") +
          (splitY.isDragging ? " resizing-y" : "")
        }
        ref={shellRef}
      >
        <header className="play-toolbar">
          <div className="play-actions">
            <button className="btn primary" onClick={run} disabled={running}>
              <Play size={16} /> {running ? "Running…" : "Run"}
            </button>
            <button
              className="tool-button"
              onClick={reset}
              title="Reset to demo"
            >
              <RotateCcw size={17} />
            </button>
            <select
              value={language}
              onChange={(event) => selectLanguage(event.target.value)}
              aria-label="Language"
            >
              {languages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Project title"
          />
          <div className="play-actions">
            {isWeb && (
              <label className="live-toggle">
                <input
                  type="checkbox"
                  checked={livePreview}
                  onChange={(event) => setLivePreview(event.target.checked)}
                />{" "}
                Live
              </label>
            )}
            <button className="tool-button" onClick={copy} title="Copy code">
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
            <button className="tool-button" onClick={download} title="Download">
              <Download size={17} />
            </button>
            <button
              className={"tool-button" + (isFitToScreen ? " active" : "")}
              onClick={toggleFitToScreen}
              title={isFitToScreen ? "Exit fit to screen" : "Fit to screen"}
              aria-pressed={isFitToScreen}
            >
              {isFitToScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button className="btn ghost" onClick={save}>
              <Save size={16} /> Save
            </button>
          </div>
        </header>
        <div className="play-body">
          <aside className="file-sidebar">
            <strong>Languages</strong>
            <div className="web-files">
              {["html", "css", "javascript"].map((item) => (
                <button
                  key={item}
                  className={isWeb && file === item ? "selected" : ""}
                  onClick={() => {
                    setLanguage("web");
                    setFile(item);
                  }}
                >
                  {item === "javascript" ? "JavaScript" : item.toUpperCase()}
                </button>
              ))}
            </div>
            <select
              className="language-dropdown"
              value={language}
              onChange={(e) => selectLanguage(e.target.value)}
            >
              {languages
                .filter((item) => item.id !== "web" && item.id !== "javascript")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
            </select>
            <div className="saved-projects">
              <strong>My playgrounds</strong>
              {isAuthenticated ? (
                saved.length ? (
                  saved.slice(0, 6).map((item) => (
                    <div key={item._id}>
                      <button onClick={() => openProject(item)}>
                        {item.title}
                      </button>
                      <button
                        aria-label={"Delete " + item.title}
                        onClick={() => removeProject(item._id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <small>No saved projects yet.</small>
                )
              ) : (
                <small>Login to save projects.</small>
              )}
            </div>
          </aside>
          <div className="play-split-row" ref={splitRowRef}>
            <div
              className="play-left-column"
              ref={leftColumnRef}
              style={isDesktopLayout ? { flexBasis: `calc(${splitX.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined}
            >
              <div className="editor-panel" ref={editorPanelRef} style={isDesktopLayout ? { flexBasis: `calc(${splitY.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined}>
                <div className="panel-label">{isWeb ? file : language}</div>
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={editorLanguage[isWeb ? file : language] || "plaintext"}
                  value={currentCode}
                  onMount={(editorInstance) => {
                    editorInstanceRef.current = editorInstance;
                  }}
                  onChange={(value) =>
                    isWeb
                      ? setCode({ ...code, [file]: value || "" })
                      : setSingleCode(value || "")
                  }
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    wordWrap: "on",
                    padding: { top: 16 },
                    automaticLayout: true,
                  }}
                />
              </div>
              <ResizeHandle orientation="horizontal" isDragging={splitY.isDragging} {...splitY.handleProps} />
              <div
                className="console-panel"
                style={isDesktopLayout ? { flexBasis: `calc(${100 - splitY.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined}
              >
                <div className="panel-label">
                  Console <button onClick={() => setConsoleLines([])}>Clear</button>
                </div>
                <div>
                  {consoleLines.map((line, index) => (
                    <p className={line.type} key={line.text + index}>
                      {line.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <ResizeHandle orientation="vertical" isDragging={splitX.isDragging} {...splitX.handleProps} />
            <div
              className="preview-panel"
              style={isDesktopLayout ? { flexBasis: `calc(${100 - splitX.ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined}
            >
              <div className="panel-label">
                {isWeb ? "Preview" : "Standard input"}
              </div>
              {isWeb ? (
                <iframe
                  key={runVersion}
                  title="Playground preview"
                  sandbox="allow-scripts"
                  srcDoc={srcDoc}
                />
              ) : (
                <textarea
                  className="stdin-editor"
                  value={stdin}
                  onChange={(event) => setStdin(event.target.value)}
                  placeholder="Optional standard input…"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {status && <p className="notice">{status}</p>}
    </section>
  );
}
