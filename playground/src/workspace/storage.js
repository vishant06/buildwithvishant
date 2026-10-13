// Per-account browser storage for the Playground.
//
// Everything private (workspace draft, parked workspaces, run history, tests,
// stdin) lives under a key that includes the signed-in account's id, so one
// account's code can never be loaded for another account or for a visitor.
// Signed-out visitors get a separate "guest" namespace kept in sessionStorage
// (gone when the tab closes), which never holds an account's data.
//
// This is a convenience cache only. It is NOT an authorization mechanism: the
// API checks ownership on every request.

export const GUEST = "guest";

// Unscoped keys used by earlier versions. They were shared by every account on
// this browser, so they are never read again.
export const LEGACY_PRIVATE_KEYS = [
  "playground_workspace_v2",
  "playground_ws_by_language",
  "playground_draft",
  "playground_history",
  "playground_tests",
  "playground_stdin",
];
export const QUARANTINE_KEY = "playground_legacy_quarantine_v1";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const decodeClaims = (token) => {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    return null;
  }
};

// The namespace for the session token currently in use. The id comes from the
// token's own claim (the same id the API will use), not from a cached profile.
// A missing, malformed or expired token is the guest namespace.
export const namespaceFor = (token, now = Date.now()) => {
  if (!token) return GUEST;
  const claims = decodeClaims(token);
  if (!claims || typeof claims.id !== "string" || !OBJECT_ID.test(claims.id)) return GUEST;
  if (typeof claims.exp === "number" && claims.exp * 1000 <= now) return GUEST;
  return `u_${claims.id}`;
};

const defaultBackend = (namespace) => (namespace === GUEST ? globalThis.sessionStorage : globalThis.localStorage);

export const scopedKey = (base, namespace) => `${base}:${namespace}`;

// A small store bound to one namespace. `backend` is injectable for tests.
export const createScopedStore = (namespace, backend = defaultBackend(namespace)) => {
  const key = (base) => scopedKey(base, namespace);
  return {
    namespace,
    getText(base) {
      try {
        return backend.getItem(key(base));
      } catch {
        return null;
      }
    },
    setText(base, value) {
      try {
        backend.setItem(key(base), String(value));
        return true;
      } catch {
        return false; // quota or blocked storage: persistence is best-effort
      }
    },
    getJson(base, fallback = null) {
      try {
        const raw = backend.getItem(key(base));
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    setJson(base, value) {
      return this.setText(base, JSON.stringify(value));
    },
    remove(base) {
      try {
        backend.removeItem(key(base));
      } catch {
        // ignore
      }
    },
  };
};

// One-time, non-destructive: moves the old shared keys into a single inert
// quarantine entry that the app never reads, so they stop appearing for
// whoever signs in next. Nothing is deleted unless the copy succeeded, and an
// entry that is already quarantined is never overwritten.
export const quarantineLegacyStorage = (backend = globalThis.localStorage) => {
  try {
    const found = {};
    for (const key of LEGACY_PRIVATE_KEYS) {
      const value = backend.getItem(key);
      if (value !== null) found[key] = value;
    }
    if (!Object.keys(found).length) return 0;
    let existing = {};
    try {
      existing = JSON.parse(backend.getItem(QUARANTINE_KEY) || "{}") || {};
    } catch {
      existing = {};
    }
    const merged = { ...found, ...existing };
    backend.setItem(QUARANTINE_KEY, JSON.stringify(merged));
    for (const key of Object.keys(found)) backend.removeItem(key);
    return Object.keys(found).length;
  } catch {
    return 0; // storage unavailable: nothing was removed
  }
};
