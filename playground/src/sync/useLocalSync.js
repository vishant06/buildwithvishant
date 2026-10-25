import { useCallback, useEffect, useRef, useState } from "react";
import * as S from "../workspace/state.js";
import { SyncController, initialState } from "./controller.js";
import { pickFolder, supportsLocalSync } from "./localFs.js";
import { connectionKey, createIndexedDbStore, createMemoryStore } from "./store.js";

let sharedStore;
const getStore = () => {
  if (!sharedStore) {
    try {
      sharedStore = typeof indexedDB !== "undefined" ? createIndexedDbStore() : createMemoryStore();
    } catch {
      sharedStore = createMemoryStore();
    }
  }
  return sharedStore;
};

// Connects the open project to a local folder. Only active for a signed-in user
// with a saved project (the connection is keyed by account + project, so two
// accounts or two projects never share a folder).
export default function useLocalSync({ namespace, projectId, enabled, latest, apply, nodes }) {
  const supported = supportsLocalSync();
  const [state, setState] = useState(() => initialState(supported ? "disconnected" : "unsupported"));
  const ctlRef = useRef(null);
  const active = Boolean(enabled && projectId);

  useEffect(() => {
    if (!active) {
      setState(initialState(supported ? "disconnected" : "unsupported"));
      return undefined;
    }
    const ctl = new SyncController({
      key: connectionKey(namespace, projectId),
      store: getStore(),
      supported,
      getWorkspace: latest,
      applyWorkspaceOps: async (ops) => {
        let results = [];
        apply((current) => {
          const out = S.applySyncOps(current, ops);
          results = out.results;
          return out;
        });
        return results;
      },
    });
    ctlRef.current = ctl;
    setState(ctl.state);
    const unsubscribe = ctl.subscribe(setState);
    const wake = () => {
      if (!document.hidden) ctl.syncNow();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    ctl.init().catch((error) => ctl.logError(error?.message || "Could not load the folder connection."));
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      unsubscribe();
      ctl.destroy();
      ctlRef.current = null;
    };
  }, [active, namespace, projectId, supported]);

  useEffect(() => {
    ctlRef.current?.notifyWorkspaceChanged();
  }, [nodes]);

  const connect = useCallback(async () => {
    try {
      const handle = await pickFolder(); // must run straight from the click
      await ctlRef.current?.chooseFolder(handle);
    } catch (error) {
      if (error?.name !== "AbortError") ctlRef.current?.logError(error?.message || "Could not open the folder.");
    }
  }, []);

  const call = (name) => (...args) => ctlRef.current?.[name](...args);
  return {
    state,
    supported,
    available: active,
    connect,
    confirmConnect: call("confirmConnect"),
    cancelPreview: call("cancelPreview"),
    allowAccess: call("allowAccess"),
    pause: call("pause"),
    resume: call("resume"),
    syncNow: call("syncNow"),
    disconnect: call("disconnect"),
    resolveConflict: call("resolveConflict"),
    resolvePending: call("resolvePending"),
    resolveAllPending: call("resolveAllPending"),
    restoreTrash: call("restoreTrash"),
    discardTrash: call("discardTrash"),
    setIncludeSensitive: call("setIncludeSensitive"),
  };
}
