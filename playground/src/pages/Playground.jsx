import Editor from "@monaco-editor/react";
import {
  Check,
  Cloud,
  Clock,
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Square,
  Terminal,
  Trash2,
  Undo2,
  Upload,
  X,
  FolderInput,
  Copy as CopyIcon,
  History,
  ListChecks,
  AlertTriangle,
  Flag,
} from "lucide-react";
import { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import request from "@shared/api/request.js";
import { useAuth } from "@shared/auth/AuthContext.jsx";
import { MAIN_SITE_URL } from "@shared/config/urls.js";
import { useTheme } from "@shared/theme/ThemeContext.jsx";
import { WorkspaceError, basename, checkJavaProject, dirname, isInside } from "@shared/workspace/core.js";
import ContextMenu from "../components/ContextMenu.jsx";
import EditorTabs from "../components/EditorTabs.jsx";
import FileExplorer from "../components/FileExplorer.jsx";
import { ConfirmModal, MoveModal, NameModal } from "../components/Modals.jsx";
import { HistoryPanel, TestsPanel } from "../components/OutputPanels.jsx";
import QuickOpen from "../components/QuickOpen.jsx";
import ResizeHandle from "../components/ResizeHandle.jsx";
import useIsDesktopLayout from "../hooks/useIsDesktopLayout.js";
import useResizableSplit from "../hooks/useResizableSplit.js";
import useWorkspace from "../hooks/useWorkspace.js";
import { readUploads } from "../workspace/importer.js";
import { EXTENSIONLESS_OK, detectProjectLanguage, extensionsFor, languages, monacoLanguageFor } from "../workspace/languages.js";
import { buildPreview } from "../workspace/preview.js";
import * as S from "../workspace/state.js";
import * as tree from "../workspace/tree.js";
import { createZip } from "../workspace/zip.js";
import "./playground.css";

// Panel sizing for the resizable IDE layout. Minimums are in px and enforced
// by useResizableSplit; defaults are percentages of the container.
const MIN_EDITOR_WIDTH = 320;
const MIN_OUTPUT_WIDTH = 280;
const MIN_EXPLORER_WIDTH = 160;
const MIN_CODE_WIDTH = 280;
const MIN_TOP_HEIGHT = 120;
const MIN_BOTTOM_HEIGHT = 84;
const HANDLE_SIZE = 8;
const DEFAULT_SPLIT_X = 62; // (explorer + editor) vs output column
const DEFAULT_SPLIT_E = 26; // explorer vs editor
const DEFAULT_SPLIT_Y = 68; // output/preview vs stdin/console within the output column

const HISTORY_KEY = "playground_history";
const TESTS_KEY = "playground_tests";
const FONT_KEY = "playground_font_size";
const STDIN_KEY = "playground_stdin";
const EXPLORER_KEY = "playground_explorer_open";
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

// Turns the /playground/execute response into console lines.
const toLines = (result) => {
  const output = [result.stdout, result.compileOutput, result.stderr, result.message].filter(Boolean);
  const type = result.success ? "success" : "error";
  if (output.length) return output.map((text) => ({ type, text }));
  return [{ type, text: result.success ? "Execution completed with no output." : result.status }];
};

const safeFileName = (name, fallback) => (String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || fallback).slice(0, 80);

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const textBlob = (text) => new Blob([text], { type: "text/plain;charset=utf-8" });

// The three files the single-file HTML/CSS/JS Playground used.
const isLegacyWebTrio = (nodes) =>
  nodes.length === 3 && ["index.html", "style.css", "script.js"].every((path) => nodes.some((node) => node.type === "file" && node.path === path));

const welcomeLines = [{ type: "info", text: "Ready. Press Run to execute your code." }];

const Playground = forwardRef(function Playground(_props, ref) {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { ws, apply, load, switchLanguage } = useWorkspace();

  const [stdin, setStdin] = useState(() => localStorage.getItem(STDIN_KEY) || "");
  const [saved, setSaved] = useState([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(() => (ws.language === "web" ? buildPreview(ws.nodes, S.entryPath(ws)) : ""));
  const [runVersion, setRunVersion] = useState(0);
  const [consoleLines, setConsoleLines] = useState(welcomeLines);
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
  const [modal, setModal] = useState(null); // { type, ... }
  const [menu, setMenu] = useState(null); // { x, y, items }
  const [quickOpen, setQuickOpen] = useState(null); // { initial }

  const isDesktopLayout = useIsDesktopLayout();
  const [explorerOpen, setExplorerOpen] = useState(() => {
    const stored = localStorage.getItem(EXPLORER_KEY);
    return stored === null ? window.matchMedia("(min-width: 821px)").matches : stored === "1";
  });

  const bodyRef = useRef(null); // flex row: [explorer + editor] [handle] [output]
  const workRef = useRef(null); // flex row: [explorer] [handle] [editor]
  const outputColumnRef = useRef(null); // flex column: [top] [handle] [bottom]
  const editorPanelRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const monacoRef = useRef(null);
  const previewFrameRef = useRef(null);
  const abortRef = useRef(null);
  const uploadRef = useRef(null);
  const revealRef = useRef(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = Boolean(modal || quickOpen);

  const isWeb = ws.language === "web";
  const languageLabel = languages.find((item) => item.id === ws.language)?.label || ws.language;
  const activeNode = S.nodeById(ws, ws.activeId);
  const entry = S.entryPath(ws);
  const dirtyIds = useMemo(() => new Set(S.dirtyFileIds(ws)), [ws]);
  const projectDirty = S.isProjectDirty(ws);
  const openFiles = ws.openIds.map((id) => S.nodeById(ws, id)).filter(Boolean);
  const allFiles = useMemo(() => ws.nodes.filter((node) => node.type === "file"), [ws.nodes]);
  const currentTests = tests[ws.language] || [];

  // Live Java check (class name vs file name, entry has main), deferred so typing stays smooth.
  const deferredFiles = useDeferredValue(allFiles);
  const javaCheck = useMemo(
    () => (ws.language === "java" ? checkJavaProject(deferredFiles.map((file) => ({ path: file.path, content: file.content })), entry) : null),
    [ws.language, deferredFiles, entry],
  );
  const activeIssues = javaCheck && activeNode ? javaCheck.errors.filter((issue) => issue.path === activeNode.path) : [];

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
    min1: MIN_EDITOR_WIDTH + (explorerOpen ? MIN_EXPLORER_WIDTH : 0),
    min2: MIN_OUTPUT_WIDTH,
    handleSize: HANDLE_SIZE,
    defaultRatio: DEFAULT_SPLIT_X,
    storageKey: "playground_split_x",
    enabled: isDesktopLayout,
    onSettle: forcePreviewReflow,
  });
  const splitE = useResizableSplit({
    containerRef: workRef,
    axis: "x",
    min1: MIN_EXPLORER_WIDTH,
    min2: MIN_CODE_WIDTH,
    handleSize: HANDLE_SIZE,
    defaultRatio: DEFAULT_SPLIT_E,
    storageKey: "playground_split_explorer",
    enabled: isDesktopLayout && explorerOpen,
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
  // resize, fullscreen, explorer toggle).
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

  // Free Monaco models of files that no longer exist (deleted / replaced projects).
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const ids = new Set(ws.nodes.map((node) => node.id));
    for (const model of monaco.editor.getModels()) {
      const id = model.uri.path.split("/")[1];
      if (id && !ids.has(id)) model.dispose();
    }
  }, [ws.nodes]);

  // After "go to line" from Quick Open: reveal it once the file's model is showing.
  useEffect(() => {
    const target = revealRef.current;
    if (!target || target.id !== ws.activeId) return undefined;
    const timer = setTimeout(() => {
      const editor = editorInstanceRef.current;
      editor?.revealLineInCenter(target.line);
      editor?.setPosition({ lineNumber: target.line, column: 1 });
      editor?.focus();
      revealRef.current = null;
    }, 60);
    return () => clearTimeout(timer);
  }, [ws.activeId]);

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

  useEffect(() => writeJson(TESTS_KEY, tests), [tests]);
  useEffect(() => localStorage.setItem(FONT_KEY, String(fontSize)), [fontSize]);
  useEffect(() => localStorage.setItem(STDIN_KEY, stdin), [stdin]);
  useEffect(() => localStorage.setItem(EXPLORER_KEY, explorerOpen ? "1" : "0"), [explorerOpen]);

  // Rebuild the preview when a different web project is shown, and on every edit while "Live" is on.
  useEffect(() => {
    if (isWeb) setPreviewDoc(buildPreview(ws.nodes, entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.projectId, ws.language]);

  useEffect(() => {
    if (!livePreview || !isWeb) return;
    setPreviewDoc(buildPreview(ws.nodes, entry));
    setConsoleLines([{ type: "info", text: "Preview refreshed." }]);
    setRunVersion((version) => version + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.nodes, livePreview]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useImperativeHandle(ref, () => ({ openSaved: () => setSavedOpen(true) }));

  const say = (message) => setStatus(message);
  const fail = (result) => {
    if (!result.ok) say(result.error);
    return result.ok;
  };

  // ---- editing

  const edit = (value) => {
    if (activeNode) apply((current) => S.editFile(current, activeNode.id, value ?? ""));
  };

  const chooseLanguage = (next) => {
    if (next === ws.language) return;
    switchLanguage(next);
    setStatus("");
    setRunMs(null);
    setTab("output");
    setConsoleLines(welcomeLines);
  };

  const editorCommand = (name) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    editor.focus();
    editor.trigger("toolbar", name, null);
  };

  // ---- explorer actions

  const targetDir = () => {
    const selected = S.nodeById(ws, ws.selectedId);
    if (!selected) return "";
    return selected.type === "folder" ? selected.path : dirname(selected.path);
  };

  const closeExplorerOnPhone = () => {
    if (!isDesktopLayout) setExplorerOpen(false);
  };

  const openFile = (id, line) => {
    if (line) revealRef.current = { id, line };
    apply((current) => S.openFile(current, id));
    closeExplorerOnPhone();
  };

  const nameHint = (value) => {
    const name = basename(value.trim());
    if (!name || name.includes(".") || EXTENSIONLESS_OK.test(name)) return "";
    const exts = extensionsFor(ws.language);
    return exts.length ? `No extension. Add ${exts[0]} if you want syntax highlighting (names are kept exactly as typed).` : "";
  };

  const askNewFile = (dir = targetDir()) => {
    setModal({
      type: "name",
      title: "New file",
      label: dir ? `File name (in ${dir}/)` : "File name",
      placeholder: ws.language === "java" ? "Student.java" : ws.language === "python" ? "utils.py" : "name.ext",
      submitLabel: "Create file",
      validate: (value) => {
        try {
          S.addFile(ws, dir, value);
          return "";
        } catch (error) {
          return error instanceof WorkspaceError ? error.message : "Invalid name.";
        }
      },
      hint: nameHint,
      onSubmit: (value) => {
        if (fail(apply((current) => S.addFile(current, dir, value)))) closeExplorerOnPhone();
        setModal(null);
      },
    });
    setExplorerOpen(true);
  };

  const askNewFolder = (dir = targetDir()) => {
    setModal({
      type: "name",
      title: "New folder",
      label: dir ? `Folder name (in ${dir}/)` : "Folder name",
      placeholder: "src",
      submitLabel: "Create folder",
      validate: (value) => {
        try {
          S.addFolder(ws, dir, value);
          return "";
        } catch (error) {
          return error instanceof WorkspaceError ? error.message : "Invalid name.";
        }
      },
      onSubmit: (value) => {
        fail(apply((current) => S.addFolder(current, dir, value)));
        setModal(null);
      },
    });
    setExplorerOpen(true);
  };

  const askRename = (id) => {
    const node = S.nodeById(ws, id);
    if (!node) return;
    setModal({
      type: "name",
      title: node.type === "folder" ? "Rename folder" : "Rename file",
      label: "New name",
      initial: basename(node.path),
      submitLabel: "Rename",
      validate: (value) => {
        try {
          S.renameItem(ws, id, value);
          return "";
        } catch (error) {
          return error instanceof WorkspaceError ? error.message : "Invalid name.";
        }
      },
      onSubmit: (value) => {
        fail(apply((current) => S.renameItem(current, id, value)));
        setModal(null);
      },
    });
  };

  const askRenameProject = () => {
    setModal({
      type: "name",
      title: "Rename project",
      label: "Project name",
      initial: ws.name,
      submitLabel: "Rename",
      validate: (value) => (value.trim().length > 100 ? "Project name is too long (max 100 characters)." : ""),
      onSubmit: (value) => {
        apply((current) => S.setName(current, value.trim()));
        setModal(null);
      },
    });
  };

  const askDelete = (id) => {
    const node = S.nodeById(ws, id);
    if (!node) return;
    const inside = node.type === "folder" ? tree.descendantsOf(ws.nodes, node.path) : [];
    const unsaved = [node, ...inside].some((item) => item.type === "file" && dirtyIds.has(item.id));
    setModal({
      type: "confirm",
      title: node.type === "folder" ? "Delete folder" : "Delete file",
      message:
        node.type === "folder"
          ? `Delete the folder "${node.path}" and everything inside it (${inside.length} item${inside.length === 1 ? "" : "s"})? ${unsaved ? "It contains unsaved changes. " : ""}This cannot be undone.`
          : `Delete "${node.path}"? ${unsaved ? "It has unsaved changes. " : ""}This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        apply((current) => S.deleteItem(current, id));
        setModal(null);
        say(`Deleted ${node.path}. Press Save to keep the deletion.`);
      },
    });
  };

  const askMove = (id) => {
    const node = S.nodeById(ws, id);
    if (!node) return;
    const folders = tree.folderPaths(ws.nodes).filter((path) => node.type !== "folder" || !isInside(path, node.path));
    setModal({
      type: "move",
      name: basename(node.path),
      folders,
      current: dirname(node.path),
      onSubmit: (dest) => {
        fail(apply((current) => S.moveItem(current, id, dest)));
        setModal(null);
      },
    });
  };

  const moveByDrop = (id, destDir) => fail(apply((current) => S.moveItem(current, id, destDir)));

  const duplicate = (id) => fail(apply((current) => S.duplicateItem(current, id)));

  const setEntryFile = (id) => {
    if (fail(apply((current) => S.setEntry(current, id)))) say(`Entry file: ${S.nodeById(ws, id)?.path}`);
  };

  const requestCloseTab = (id) => {
    const node = S.nodeById(ws, id);
    if (!node) return;
    if (dirtyIds.has(id)) {
      setModal({
        type: "confirm",
        title: "Close with unsaved changes?",
        message: `"${basename(node.path)}" has changes that are not saved to My Playground. Closing the tab keeps them in this workspace (and in your browser draft), but only Save stores them permanently.`,
        confirmLabel: "Close tab",
        onConfirm: () => {
          apply((current) => S.closeTab(current, id));
          setModal(null);
        },
      });
      return;
    }
    apply((current) => S.closeTab(current, id));
  };

  // ---- download / upload

  const downloadFile = (node) => downloadBlob(textBlob(node.content || ""), basename(node.path));

  const zipOf = (rootName, nodes, prefix) => {
    const entries = nodes.map((node) => {
      const relative = prefix ? node.path.slice(prefix.length + 1) : node.path;
      const path = `${rootName}/${relative}`;
      return node.type === "folder" ? { path: `${path}/`, folder: true } : { path, content: node.content || "" };
    });
    return createZip([{ path: `${rootName}/`, folder: true }, ...entries.filter((entryItem) => entryItem.path !== `${rootName}/`)]);
  };

  const downloadFolder = (id) => {
    const folder = S.nodeById(ws, id);
    if (!folder) return;
    const rootName = safeFileName(basename(folder.path), "folder");
    downloadBlob(zipOf(rootName, tree.descendantsOf(ws.nodes, folder.path), folder.path), `${rootName}.zip`);
  };

  const downloadProject = () => {
    const files = ws.nodes.filter((node) => node.type === "file");
    if (files.length === 1 && ws.nodes.length === 1) {
      downloadFile(files[0]);
      return;
    }
    if (isWeb && isLegacyWebTrio(ws.nodes)) {
      // Same single combined .html the single-file Playground produced.
      const get = (path) => ws.nodes.find((node) => node.path === path)?.content || "";
      const html = `<!doctype html>\n<html><head><style>\n${get("style.css")}\n</style></head><body>\n${get("index.html")}\n<script>\n${get("script.js")}\n<\/script></body></html>`;
      downloadBlob(textBlob(html), `${safeFileName(ws.name, "playground")}.html`);
      return;
    }
    const rootName = safeFileName(ws.name, "project");
    downloadBlob(zipOf(rootName, ws.nodes, ""), `${rootName}.zip`);
  };

  const handleUploads = async (fileList) => {
    if (!fileList?.length) return;
    try {
      const upload = await readUploads(fileList);
      const skipped = upload.skipped.length ? ` (${upload.skipped.length} skipped: ${upload.skipped.slice(0, 2).map((item) => item.path).join(", ")}${upload.skipped.length > 2 ? "…" : ""})` : "";
      if (upload.kind === "zip") {
        const language = detectProjectLanguage(upload.files.map((file) => file.path), ws.language);
        const next = S.workspaceFrom({
          name: upload.name,
          language: languages.some((item) => item.id === language) ? language : ws.language,
          files: upload.files.map((file) => ({ path: file.path, type: "file", content: file.content })),
          saved: false,
        });
        const doImport = () => {
          load(next);
          setConsoleLines(welcomeLines);
          say(`Imported ${upload.files.length} files from the ZIP${skipped}.`);
          setModal(null);
        };
        if (projectDirty) {
          setModal({ type: "confirm", title: "Replace current project?", message: `Importing "${upload.name}" replaces the current workspace. Your unsaved changes here will be lost.`, confirmLabel: "Import", danger: true, onConfirm: doImport });
        } else doImport();
        return;
      }
      const dir = targetDir();
      const result = apply((current) => S.addFiles(current, dir, upload.files));
      if (fail(result)) say(`Added ${upload.files.length} file${upload.files.length === 1 ? "" : "s"}${skipped}.`);
    } catch (error) {
      say(error instanceof WorkspaceError ? error.message : "That file could not be read.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  // ---- menus

  const nodeMenu = (id, x, y) => {
    if (id === "root") {
      setMenu({ x, y, items: projectMenuItems() });
      return;
    }
    const node = S.nodeById(ws, id);
    if (!node) return;
    const items =
      node.type === "file"
        ? [
            { label: "Open", icon: FolderOpen, onClick: () => openFile(id) },
            { label: "Rename", icon: Pencil, shortcut: "F2", onClick: () => askRename(id) },
            { label: "Duplicate", icon: CopyIcon, onClick: () => duplicate(id) },
            { label: "Move to…", icon: FolderInput, onClick: () => askMove(id) },
            { label: "Download", icon: Download, onClick: () => downloadFile(node) },
            { label: id === ws.entryId ? "Entry file (current)" : "Set as Entry File", icon: Flag, disabled: id === ws.entryId, onClick: () => setEntryFile(id) },
            { separator: true },
            { label: "Delete", icon: Trash2, danger: true, shortcut: "Del", onClick: () => askDelete(id) },
          ]
        : [
            { label: "New File", icon: FilePlus, onClick: () => askNewFile(node.path) },
            { label: "New Folder", icon: FolderPlus, onClick: () => askNewFolder(node.path) },
            { separator: true },
            { label: "Rename", icon: Pencil, shortcut: "F2", onClick: () => askRename(id) },
            { label: "Duplicate", icon: CopyIcon, onClick: () => duplicate(id) },
            { label: "Move to…", icon: FolderInput, onClick: () => askMove(id) },
            { label: "Download folder (ZIP)", icon: Download, onClick: () => downloadFolder(id) },
            { separator: true },
            { label: "Delete", icon: Trash2, danger: true, shortcut: "Del", onClick: () => askDelete(id) },
          ];
    setMenu({ x, y, items });
  };

  function projectMenuItems() {
    return [
      { label: "New File", icon: FilePlus, onClick: () => askNewFile("") },
      { label: "New Folder", icon: FolderPlus, onClick: () => askNewFolder("") },
      { label: "Upload files or ZIP…", icon: Upload, onClick: () => uploadRef.current?.click() },
      { separator: true },
      { label: "Rename project", icon: Pencil, onClick: askRenameProject },
      { label: "Download project", icon: Download, onClick: downloadProject },
    ];
  }

  // ---- running

  const pushHistory = (item) => {
    setHistory((items) => {
      const next = [item, ...items].slice(0, HISTORY_LIMIT);
      writeJson(HISTORY_KEY, next);
      return next;
    });
  };

  const showProblems = (problems) => {
    setConsoleLines(problems.map((problem) => ({ type: "error", text: problem.path ? `${problem.path}${problem.line ? `:${problem.line}` : ""}  ${problem.message}` : problem.message })));
    setStatus(problems[0].message);
  };

  const run = async () => {
    if (running) return;
    setTab("output");
    if (isWeb) {
      setPreviewDoc(buildPreview(ws.nodes, entry));
      setConsoleLines([{ type: "info", text: "Preview refreshed." }]);
      setRunVersion((version) => version + 1);
      setStatus("Running in a sandboxed browser preview.");
      return;
    }
    const files = S.executionFiles(ws);
    if (!files.length) {
      showProblems([{ message: "This project has no files to run. Create one with New File." }]);
      return;
    }
    // Checked here for instant feedback; the server checks again before anything runs.
    if (ws.language === "java") {
      const check = checkJavaProject(files, entry);
      if (check.errors.length) {
        showProblems(check.errors);
        return;
      }
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setConsoleLines([{ type: "info", text: `Compiling and running ${entry || "the project"} in the sandbox…` }]);
    setStatus("Running…");
    try {
      const result = await request("/playground/execute", {
        method: "POST",
        body: JSON.stringify({ language: ws.language, files, entryFile: entry, stdin }),
        signal: controller.signal,
      });
      const lines = toLines(result);
      const label = result.success ? "Success" : result.status || "Execution error";
      setConsoleLines(lines);
      setRunMs(result.time ?? null);
      setStatus(label + (result.time !== null && result.time !== undefined ? " · " + result.time + " ms" : ""));
      const entryContent = S.entryNode(ws)?.content || "";
      pushHistory({
        id: uid(),
        language: ws.language,
        at: new Date().toISOString(),
        ok: Boolean(result.success),
        status: label,
        time: result.time ?? null,
        entry: result.entry || entry,
        code: entryContent.slice(0, 20000),
        stdin: stdin.slice(0, 2000),
        lines: lines.slice(0, 200),
      });
    } catch (error) {
      if (error.name === "AbortError") {
        setConsoleLines([{ type: "info", text: "Execution stopped." }]);
        setStatus("Stopped.");
      } else {
        const details = Array.isArray(error.data?.errors) ? error.data.errors : null;
        if (details?.length) showProblems(details);
        else {
          setConsoleLines([{ type: "error", text: error.message }]);
          setStatus("Execution failed.");
        }
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

  const askReset = () => {
    const doReset = () => {
      load(S.templateWorkspace(ws.language));
      setConsoleLines([{ type: "info", text: "Workspace reset to the demo." }]);
      setStatus("");
      setModal(null);
    };
    if (!projectDirty && ws.nodes.length <= 1) return doReset();
    return setModal({ type: "confirm", title: "Reset workspace?", message: "This replaces all files and folders with the demo program. Saved projects are not affected.", confirmLabel: "Reset", danger: true, onConfirm: doReset });
  };

  // ---- saving

  const save = async (force = false) => {
    if (!isAuthenticated) return say("Please login to save your playground.");
    if (!ws.name.trim()) return say("Give the project a name before saving.");
    const snapshot = ws;
    setSaving(true);
    try {
      const payload = { ...S.toPayload(snapshot), title: snapshot.name.trim() };
      const result = snapshot.projectId
        ? await request(`/playground/${snapshot.projectId}`, { method: "PUT", body: JSON.stringify({ ...payload, baseUpdatedAt: snapshot.serverUpdatedAt, force }) })
        : await request("/playground", { method: "POST", body: JSON.stringify(payload) });
      const marked = S.markSaved(snapshot, result);
      // Keep anything typed while the request was in flight as unsaved.
      apply((current) =>
        current.nodes === snapshot.nodes
          ? { ...marked, openIds: current.openIds, activeId: current.activeId, selectedId: current.selectedId, expanded: current.expanded }
          : { ...current, projectId: marked.projectId, serverUpdatedAt: marked.serverUpdatedAt, baseline: marked.baseline, baselineMeta: marked.baselineMeta },
      );
      setSaved((items) => [result, ...items.filter((item) => item._id !== result._id)]);
      say(`Saved ${snapshot.nodes.filter((node) => node.type === "file").length} file(s) to My Playground.`);
    } catch (error) {
      if (error.status === 409) {
        setModal({ type: "confirm", title: "Project changed elsewhere", message: "This project was saved from another tab or device after you opened it. Overwrite it with the version in this editor?", confirmLabel: "Overwrite", danger: true, onConfirm: () => { setModal(null); save(true); } });
      } else say(error.message);
    } finally {
      setSaving(false);
    }
  };

  const openProject = async (project) => {
    const doOpen = async () => {
      setModal(null);
      try {
        const full = await request(`/playground/${project._id}`);
        load(S.workspaceFromProject(full));
        setConsoleLines(welcomeLines);
        say(`Opened ${full.title}.`);
        setSavedOpen(false);
      } catch (error) {
        say(error.message);
      }
    };
    if (projectDirty && ws.projectId !== project._id) {
      setModal({ type: "confirm", title: "Open another project?", message: "The current workspace has unsaved changes. Open anyway? (They stay in your browser draft until you start another project in this language.)", confirmLabel: "Open", onConfirm: doOpen });
    } else doOpen();
  };

  const newProject = () => {
    const go = () => {
      load(S.templateWorkspace(ws.language));
      setConsoleLines(welcomeLines);
      setStatus("");
      setSavedOpen(false);
      setModal(null);
    };
    if (projectDirty) setModal({ type: "confirm", title: "Start a new project?", message: "The current workspace has unsaved changes.", confirmLabel: "New project", onConfirm: go });
    else go();
  };

  const removeProject = (project) =>
    setModal({
      type: "confirm",
      title: "Delete saved project",
      message: `Delete "${project.title}" from My Playground? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        setModal(null);
        try {
          await request(`/playground/${project._id}`, { method: "DELETE" });
          setSaved((items) => items.filter((item) => item._id !== project._id));
          apply((current) => (current.projectId === project._id ? { ...current, projectId: null, serverUpdatedAt: null, baseline: {}, baselineMeta: null } : current));
          say("Saved project deleted.");
        } catch (error) {
          say(error.message);
        }
      },
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(activeNode?.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {
      say("Copy is blocked by the browser.");
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen unavailable (some mobile browsers / iframes) — the app already fills the viewport.
    }
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

  const openHistory = (item) => {
    if (item.language === ws.language) {
      const target = ws.nodes.find((node) => node.type === "file" && node.path === item.entry);
      if (target && item.code && item.code.length < 20000) apply((current) => S.editFile(current, target.id, item.code));
    }
    setStdin(item.stdin || "");
    setConsoleLines(item.lines || []);
    setRunMs(item.time);
    setStatus(item.status);
    setTab("output");
  };

  // ---- tests: each case runs the whole project with `input` as stdin and compares trimmed stdout to `expected`.
  const updateTests = (next) => setTests((all) => ({ ...all, [ws.language]: next }));
  const addTest = () => updateTests([...currentTests, { id: uid(), input: "", expected: "" }]);
  const editTest = (id, field, value) => updateTests(currentTests.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  const removeTest = (id) => updateTests(currentTests.filter((item) => item.id !== id));

  const runTests = async () => {
    if (testsRunning || isWeb || currentTests.length === 0) return;
    const files = S.executionFiles(ws);
    if (ws.language === "java") {
      const check = checkJavaProject(files, entry);
      if (check.errors.length) {
        setTab("output");
        showProblems(check.errors);
        return;
      }
    }
    setTestsRunning(true);
    setTestResults({});
    for (const item of currentTests) {
      setTestResults((all) => ({ ...all, [item.id]: { state: "running" } }));
      try {
        const result = await request("/playground/execute", {
          method: "POST",
          body: JSON.stringify({ language: ws.language, files, entryFile: entry, stdin: item.input }),
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

  // ---- keyboard shortcuts (the explorer handles F2 / Delete itself, only while it has focus)
  const commands = [
    { label: "New File", shortcut: "Ctrl+N", run: () => askNewFile() },
    { label: "New Folder", shortcut: "Ctrl+Shift+N", run: () => askNewFolder() },
    { label: "Run", shortcut: "Ctrl+Enter", run },
    { label: "Save Workspace", shortcut: "Ctrl+S", run: () => save() },
    { label: "Download Project", run: downloadProject },
    { label: "Upload Files or ZIP", run: () => uploadRef.current?.click() },
    { label: "Toggle Explorer", run: () => setExplorerOpen((open) => !open) },
    { label: "Close Active Tab", shortcut: "Ctrl+W", run: () => activeNode && requestCloseTab(activeNode.id) },
    { label: "Rename Project", run: askRenameProject },
    { label: "Reset Workspace", run: askReset },
  ];

  useEffect(() => {
    const shortcut = (event) => {
      if (modalOpenRef.current) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && event.key === "Enter") {
        event.preventDefault();
        run();
      } else if (mod && !event.shiftKey && key === "s") {
        event.preventDefault();
        save();
      } else if (mod && !event.shiftKey && key === "p") {
        event.preventDefault();
        setQuickOpen({ initial: "" });
      } else if (mod && event.shiftKey && key === "p") {
        event.preventDefault();
        setQuickOpen({ initial: ">" });
      } else if ((mod && !event.altKey && key === "n") || (event.altKey && !mod && key === "n")) {
        // Some browsers reserve Ctrl+N / Ctrl+Shift+N; Alt+N / Alt+Shift+N always work.
        event.preventDefault();
        if (event.shiftKey) askNewFolder();
        else askNewFile();
      } else if ((mod && !event.shiftKey && key === "w") || (event.altKey && !mod && key === "w")) {
        if (activeNode) {
          event.preventDefault();
          requestCloseTab(activeNode.id);
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  const ready = !running && !testsRunning;
  const rowBasis = (ratio) => (isDesktopLayout ? { flexBasis: `calc(${ratio}% - ${HANDLE_SIZE / 2}px)` } : undefined);
  const topBasis = rowBasis(splitY.ratio);
  const bottomBasis = rowBasis(100 - splitY.ratio);

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

  const loginHref = `${MAIN_SITE_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="pg-app">
      <aside className="pg-rail" aria-label="Languages">
        {RAIL.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pg-lang ${item.tone}${ws.language === item.id ? " selected" : ""}`}
            onClick={() => chooseLanguage(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={ws.language === item.id}
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
            <button type="button" className={`pg-btn icon${explorerOpen ? " on" : ""}`} onClick={() => setExplorerOpen((open) => !open)} title="Toggle file explorer" aria-label="Toggle file explorer" aria-pressed={explorerOpen}>
              <PanelLeft size={16} />
            </button>
            <button type="button" className="pg-run" onClick={run} disabled={running} title="Run (Ctrl+Enter)">
              {running ? <Loader2 size={15} className="pg-spin" /> : <Play size={15} />}
              <span>{running ? "Running" : "Run"}</span>
            </button>
            <button type="button" className="pg-btn" onClick={stop} disabled={!running && !isWeb} title="Stop">
              <Square size={13} /> <span>Stop</span>
            </button>
            <select value={ws.language} onChange={(event) => chooseLanguage(event.target.value)} aria-label="Language" className="pg-select">
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

          <input className="pg-title" value={ws.name} maxLength={100} onChange={(event) => apply((current) => S.setName(current, event.target.value))} aria-label="Project name" />

          <div className="pg-group">
            <button type="button" className="pg-btn icon-only-md" onClick={() => editorCommand("undo")} title="Undo"><Undo2 size={15} /><span>Undo</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={() => editorCommand("redo")} title="Redo"><Redo2 size={15} /><span>Redo</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={askReset} title="Reset to demo"><RotateCcw size={15} /><span>Reset</span></button>
            <span className="pg-sep" />
            <button type="button" className="pg-btn icon-only-md" onClick={copy} title="Copy this file">{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? "Copied" : "Copy"}</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={() => save()} disabled={saving} title="Save workspace (Ctrl+S)">{saving ? <Loader2 size={15} className="pg-spin" /> : <Save size={15} />}<span>{saving ? "Saving" : "Save"}</span></button>
            <button type="button" className="pg-btn icon-only-md" onClick={downloadProject} title="Download project (ZIP for several files)"><Download size={15} /><span>Download</span></button>
            <span className="pg-sep" />
            <button type="button" className="pg-btn icon" onClick={() => setQuickOpen({ initial: "" })} title="Quick open (Ctrl+P)" aria-label="Quick open file"><Search size={15} /></button>
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
                <span>
                  <button type="button" className="pg-btn" onClick={newProject}><Plus size={14} /> New</button>
                  <button type="button" className="pg-btn icon" onClick={() => setSavedOpen(false)} aria-label="Close"><X size={15} /></button>
                </span>
              </div>
              {!isAuthenticated ? (
                <p className="pg-drawer-note">
                  <a href={loginHref}>Log in</a> to save and reopen your playgrounds.
                </p>
              ) : saved.length === 0 ? (
                <p className="pg-drawer-note">No saved projects yet. Press Save (Ctrl+S).</p>
              ) : (
                <ul>
                  {saved.map((item) => (
                    <li key={item._id} className={item._id === ws.projectId ? "current" : ""}>
                      <button type="button" onClick={() => openProject(item)}>
                        <strong>{item.title}</strong>
                        <small>{languages.find((entryItem) => entryItem.id === item.language)?.label || "HTML / CSS / JS"}</small>
                      </button>
                      <button type="button" className="pg-btn icon" onClick={() => removeProject(item)} aria-label={"Delete " + item.title}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div
            className={`pg-body${splitX.isDragging ? " resizing-x" : ""}${splitE.isDragging ? " resizing-x" : ""}${splitY.isDragging ? " resizing-y" : ""}`}
            ref={bodyRef}
          >
            <div className="pg-work" ref={workRef} style={rowBasis(splitX.ratio)}>
              {explorerOpen && !isDesktopLayout && <button type="button" className="pg-scrim" aria-label="Close file explorer" onClick={() => setExplorerOpen(false)} />}
              {explorerOpen && (
                <>
                  <div className="pg-explorer-pane" style={rowBasis(splitE.ratio)}>
                    <FileExplorer
                      ws={ws}
                      dirtyIds={dirtyIds}
                      onNewFile={() => askNewFile()}
                      onNewFolder={() => askNewFolder()}
                      onUpload={() => uploadRef.current?.click()}
                      onCollapseAll={() => apply((current) => ({ ...current, expanded: [] }))}
                      onProjectMenu={(x, y) => setMenu({ x, y, items: projectMenuItems() })}
                      onSelect={(id) => apply((current) => S.select(current, id))}
                      onOpen={(id) => openFile(id)}
                      onToggle={(id) => apply((current) => S.toggleFolder(current, id))}
                      onContextMenu={nodeMenu}
                      onRename={askRename}
                      onDelete={askDelete}
                      onMove={moveByDrop}
                    />
                  </div>
                  <ResizeHandle orientation="vertical" isDragging={splitE.isDragging} {...splitE.handleProps} />
                </>
              )}

              <section className="pg-editor">
                <EditorTabs files={openFiles} activeId={ws.activeId} dirtyIds={dirtyIds} entryId={ws.entryId} onActivate={(id) => apply((current) => S.activate(current, id))} onClose={requestCloseTab} />
                {activeIssues.length > 0 && (
                  <div className="ws-banner" role="alert">
                    <AlertTriangle size={14} aria-hidden="true" />
                    <span>{activeIssues[0].message}{activeIssues.length > 1 ? ` (+${activeIssues.length - 1} more)` : ""}</span>
                  </div>
                )}
                <div className="pg-editor-host" ref={editorPanelRef}>
                  {activeNode ? (
                    <Editor
                      height="100%"
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      path={`file:///${activeNode.id}/${basename(activeNode.path)}`}
                      language={monacoLanguageFor(activeNode.path, ws.language)}
                      value={activeNode.content || ""}
                      loading={<div className="pg-empty"><Loader2 size={22} className="pg-spin" /></div>}
                      onMount={(editorInstance, monaco) => {
                        editorInstanceRef.current = editorInstance;
                        monacoRef.current = monaco;
                        editorInstance.onDidChangeCursorPosition((event) =>
                          setCursor({ line: event.position.lineNumber, column: event.position.column }),
                        );
                      }}
                      onChange={edit}
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
                  ) : (
                    <div className="pg-empty ws-nofile">
                      <FilePlus size={30} aria-hidden="true" />
                      <p>{allFiles.length ? "Open a file from the explorer" : "This project has no files yet"}</p>
                      <small>Ctrl+P to find a file · Ctrl+N for a new one</small>
                      <button type="button" className="pg-btn" onClick={() => askNewFile()}><FilePlus size={14} /> New File</button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <ResizeHandle orientation="vertical" isDragging={splitX.isDragging} {...splitX.handleProps} />

            <section className="pg-output" style={rowBasis(100 - splitX.ratio)}>
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
                        <iframe ref={previewFrameRef} key={runVersion} title="Playground preview" sandbox="allow-scripts" srcDoc={previewDoc} />
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
                  <HistoryPanel history={history} limit={HISTORY_LIMIT} onOpen={openHistory} />
                </div>
              )}

              {tab === "tests" && (
                <div className="pg-scroll pg-tests">
                  <TestsPanel isWeb={isWeb} cases={currentTests} results={testResults} running={testsRunning} onAdd={addTest} onEdit={editTest} onRemove={removeTest} onRun={runTests} />
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="pg-status">
          <span className="pg-ready"><span className={`dot ${ready ? "ok" : "busy"}`} aria-hidden="true" /> {status || (ready ? `Ready · ${languageLabel} ${isWeb ? "runs in browser" : "runs in cloud"}` : "Working…")}</span>
          <span className="pg-status-right">
            {projectDirty && <span className="pg-chip warn" title="Changes not saved to My Playground">Unsaved</span>}
            {entry && !isWeb && <span className="pg-chip" title="Run starts from this file">Entry: {basename(entry)}</span>}
            <span className="pg-chip"><Cloud size={12} /> {isWeb ? "Local" : "Cloud"}</span>
            <span className="pg-chip"><Clock size={12} /> {runMs === null ? "-- ms" : `${runMs} ms`}</span>
            <span className="pg-chip">Ln {cursor.line}, Col {cursor.column}</span>
          </span>
        </footer>
      </div>

      <input ref={uploadRef} type="file" multiple hidden onChange={(event) => handleUploads(event.target.files)} aria-label="Upload files or ZIP" />

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {modal?.type === "name" && <NameModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "confirm" && <ConfirmModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "move" && <MoveModal {...modal} onClose={() => setModal(null)} />}
      {quickOpen && (
        <QuickOpen
          files={allFiles}
          commands={commands}
          initial={quickOpen.initial}
          onOpenFile={(id, line) => openFile(id, line)}
          onClose={() => setQuickOpen(null)}
        />
      )}
    </div>
  );
});

export default Playground;
