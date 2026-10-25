import Editor from "@monaco-editor/react";
import { ExternalLink, Eye, File, Folder, Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import request from "@shared/api/request.js";
import { useTheme } from "@shared/theme/ThemeContext.jsx";
import { basename } from "@shared/workspace/core.js";
import { languages, monacoLanguageFor } from "../workspace/languages.js";
import { buildTree } from "../workspace/tree.js";
import "../components/share.css";

// Read-only view of a public project at /p/<slug>. No editing, saving or running:
// the data comes from a read-only API that checks, on every request, that the
// project is still public.
function Rows({ nodes, depth, activePath, onOpen }) {
  return nodes.map((node) => (
    <div key={node.path}>
      {node.type === "folder" ? (
        <button type="button" className="folder" style={{ paddingLeft: 8 + depth * 14 }} tabIndex={-1}><Folder size={14} /> {node.name}</button>
      ) : (
        <button type="button" className={node.path === activePath ? "active" : ""} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => onOpen(node.path)}><File size={14} /> {node.name}</button>
      )}
      {node.children && <Rows nodes={node.children} depth={depth + 1} activePath={activePath} onOpen={onOpen} />}
    </div>
  ));
}

export default function PublicProject({ slug }) {
  const { theme } = useTheme();
  const [state, setState] = useState({ loading: true, project: null, error: "" });
  const [active, setActive] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, project: null, error: "" });
    request(`/playground/public/${encodeURIComponent(slug)}`)
      .then((project) => {
        if (cancelled) return;
        setState({ loading: false, project, error: "" });
        const files = project.workspace.files.filter((file) => file.type === "file");
        setActive((files.find((file) => file.path === project.workspace.entryFile) || files[0])?.path || "");
      })
      .catch((error) => !cancelled && setState({ loading: false, project: null, error: error.status === 404 ? "" : error.message, notFound: error.status === 404 }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { project } = state;
  const tree = useMemo(() => (project ? buildTree(project.workspace.files) : []), [project]);
  const file = project?.workspace.files.find((item) => item.type === "file" && item.path === active);

  if (state.loading) return <div className="pv"><div className="pv-msg"><Loader2 className="pg-spin" size={26} /></div></div>;
  if (!project) {
    return (
      <div className="pv">
        <div className="pv-msg">
          <Lock size={30} />
          <strong>{state.notFound ? "This project is private or no longer available" : "Couldn’t load this project"}</strong>
          <span>{state.notFound ? "The owner may have made it private or deleted it, or the link is wrong." : state.error}</span>
          <a className="pg-btn" href="/">Open the Playground</a>
        </div>
      </div>
    );
  }

  const languageLabel = languages.find((item) => item.id === project.language)?.label || project.language;
  return (
    <div className="pv">
      <div className="pv-head">
        <h1>{project.title}</h1>
        <span className="pv-badge"><Eye size={12} /> Read-only</span>
        <span className="pv-badge">{languageLabel}</span>
        <span className="pv-spacer" />
        {project.isOwner && project.projectId && <a className="pg-btn" href={`/?open=${project.projectId}`}><ExternalLink size={14} /> Open in editor</a>}
        <a className="pg-btn" href="/">Playground</a>
      </div>
      <div className="pv-body">
        <nav className="pv-tree" aria-label="Project files"><Rows nodes={tree} depth={0} activePath={active} onOpen={setActive} /></nav>
        <section className="pv-editor">
          {file ? (
            <>
              <div className="pv-path">{file.path}</div>
              <div className="pv-host">
                <Editor
                  height="100%"
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  path={`file:///public/${file.path}`}
                  language={monacoLanguageFor(basename(file.path), project.language)}
                  value={file.content}
                  options={{ readOnly: true, domReadOnly: true, minimap: { enabled: false }, wordWrap: "on", scrollBeyondLastLine: false, automaticLayout: true, fontSize: 14 }}
                />
              </div>
            </>
          ) : <div className="pv-msg"><File size={26} /><span>This project has no viewable files.</span></div>}
          {project.hiddenFileCount > 0 && <div className="pv-note">{project.hiddenFileCount} file{project.hiddenFileCount === 1 ? " was" : "s were"} withheld by the server (environment, key or credential files are never shown).</div>}
        </section>
      </div>
    </div>
  );
}
