import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceError } from "@shared/workspace/core.js";
import * as S from "../workspace/state.js";

// Holds the workspace and keeps a draft in localStorage so a refresh loses nothing
// (files, folders, open tabs, active file, entry file, unsaved edits).
//
//   playground_workspace_v2   the current workspace
//   playground_ws_by_language one parked workspace per language: switching language
//                             never destroys the project you were working on
//   playground_draft          the old single-file draft; migrated once, then removed
const CURRENT_KEY = "playground_workspace_v2";
const PARKED_KEY = "playground_ws_by_language";
const LEGACY_KEY = "playground_draft";

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota or blocked storage: persistence is best-effort
  }
};

const loadInitial = () => {
  const current = S.restore(read(CURRENT_KEY));
  if (current) return current;
  const legacy = read(LEGACY_KEY);
  if (legacy && typeof legacy === "object") {
    try {
      return S.workspaceFromLegacyDraft(legacy);
    } catch {
      // unreadable old draft: start fresh
    }
  }
  return S.templateWorkspace("web");
};

export default function useWorkspace() {
  const [ws, setWs] = useState(loadInitial);
  const ref = useRef(ws);

  // apply(fn): fn(current) returns the next workspace, or { ws, ...extra }.
  // Validation problems come back as { ok: false, error } for the UI to show.
  const apply = useCallback((fn) => {
    try {
      const result = fn(ref.current);
      const next = result && result.nodes ? result : result.ws;
      if (next !== ref.current) {
        ref.current = next;
        setWs(next);
      }
      return { ok: true, ...(result && !result.nodes ? result : {}) };
    } catch (error) {
      if (error instanceof WorkspaceError) return { ok: false, error: error.message };
      throw error;
    }
  }, []);

  const replace = useCallback((next) => {
    ref.current = next;
    setWs(next);
  }, []);

  // Park the current workspace (so nothing is lost) and show another.
  const park = (current) => {
    const parked = read(PARKED_KEY) || {};
    parked[current.language] = S.snapshot(current);
    write(PARKED_KEY, parked);
  };

  const switchLanguage = useCallback((language) => {
    const current = ref.current;
    if (current.language === language) return;
    park(current);
    const parked = S.restore((read(PARKED_KEY) || {})[language]);
    replace(parked && parked.language === language ? parked : S.templateWorkspace(language));
  }, [replace]);

  // Load another workspace (opened project, import, reset). The one being left is parked.
  const load = useCallback((next) => {
    park(ref.current);
    replace(next);
  }, [replace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (write(CURRENT_KEY, S.snapshot(ws))) localStorage.removeItem(LEGACY_KEY);
    }, 350);
    return () => clearTimeout(timer);
  }, [ws]);

  // The newest workspace, even before React has re-rendered (used to serialise saves).
  const latest = useCallback(() => ref.current, []);

  return { ws, apply, replace, load, switchLanguage, latest };
}
