import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceError } from "@shared/workspace/core.js";
import * as S from "../workspace/state.js";

// Holds the workspace and keeps a draft in the browser so a refresh loses nothing
// (files, folders, open tabs, active file, entry file, unsaved edits).
//
// Drafts are stored per account (see workspace/storage.js): `store` is bound to
// the signed-in account's namespace, or to the guest namespace when signed out.
//
//   playground_workspace_v2   the current workspace
//   playground_ws_by_language one parked workspace per language: switching language
//                             never destroys the project you were working on
const CURRENT_KEY = "playground_workspace_v2";
const PARKED_KEY = "playground_ws_by_language";

const loadInitial = (store) => S.restore(store.getJson(CURRENT_KEY)) || S.templateWorkspace("web");

export default function useWorkspace(store) {
  const [ws, setWs] = useState(() => loadInitial(store));
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
    const parked = store.getJson(PARKED_KEY) || {};
    parked[current.language] = S.snapshot(current);
    store.setJson(PARKED_KEY, parked);
  };

  const switchLanguage = useCallback((language) => {
    const current = ref.current;
    if (current.language === language) return;
    park(current);
    const parked = S.restore((store.getJson(PARKED_KEY) || {})[language]);
    replace(parked && parked.language === language ? parked : S.templateWorkspace(language));
  }, [replace]);

  // Load another workspace (opened project, import, reset). The one being left is parked.
  const load = useCallback((next) => {
    park(ref.current);
    replace(next);
  }, [replace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      store.setJson(CURRENT_KEY, S.snapshot(ws));
    }, 350);
    return () => clearTimeout(timer);
  }, [ws]);

  // On unmount (sign-out or account switch) flush the last edits into the
  // namespace they belong to. `store` is bound to the previous account here,
  // so nothing can land in the next account's draft.
  useEffect(() => () => {
    store.setJson(CURRENT_KEY, S.snapshot(ref.current));
  }, []);

  // The newest workspace, even before React has re-rendered (used to serialise saves).
  const latest = useCallback(() => ref.current, []);

  return { ws, apply, replace, load, switchLanguage, latest };
}
