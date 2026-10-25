// Where a connection is remembered, in this browser only.
//
//   connections : one record per (account, project): the folder handle the user
//                 granted, the "base" snapshot (what both sides last agreed on)
//                 and the sync settings. Directory handles can be stored in
//                 IndexedDB, but permission to use them is NOT: after a reload
//                 the browser asks the user again (the "Permission required" state).
//   trash       : recoverable copies of anything sync removed or replaced.
//
// Keys start with the account namespace (u_<id>), so one account can never read
// another account's connection on a shared browser. Nothing here is sent to the
// server: folder handles and file copies never leave this browser.
const DB_NAME = "bwv-playground-sync";
const DB_VERSION = 1;
export const TRASH_LIMIT = 40;
export const TRASH_MAX_CHARS = 1_000_000;

const wrap = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDb = () =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("connections")) db.createObjectStore("connections", { keyPath: "key" });
      if (!db.objectStoreNames.contains("trash")) db.createObjectStore("trash", { keyPath: "id" }).createIndex("byKey", "key");
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const prune = (items) => {
  // newest first; keep within the count and size limits
  const sorted = [...items].sort((a, b) => b.at - a.at);
  const keep = [];
  let chars = 0;
  for (const item of sorted) {
    chars += item.content.length;
    if (keep.length >= TRASH_LIMIT || chars > TRASH_MAX_CHARS) break;
    keep.push(item);
  }
  return keep;
};

export const createIndexedDbStore = () => {
  let dbPromise;
  const db = () => (dbPromise ||= openDb());
  const tx = async (names, mode, work) => {
    const database = await db();
    const transaction = database.transaction(names, mode);
    const done = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const value = await work(transaction);
    await done;
    return value;
  };
  return {
    get: (key) => tx("connections", "readonly", (t) => wrap(t.objectStore("connections").get(key))).then((v) => v || null),
    put: (record) => tx("connections", "readwrite", (t) => wrap(t.objectStore("connections").put(record))),
    remove: (key) => tx("connections", "readwrite", (t) => wrap(t.objectStore("connections").delete(key))),
    listTrash: (key) => tx("trash", "readonly", (t) => wrap(t.objectStore("trash").index("byKey").getAll(key))).then((items) => items.sort((a, b) => b.at - a.at)),
    async addTrash(key, item) {
      const record = { id: newId(), key, at: Date.now(), ...item };
      await tx("trash", "readwrite", async (t) => {
        const store = t.objectStore("trash");
        await wrap(store.put(record));
        const all = await wrap(store.index("byKey").getAll(key));
        const keep = new Set(prune(all).map((x) => x.id));
        for (const old of all) if (!keep.has(old.id)) store.delete(old.id);
      });
      return record;
    },
    removeTrash: (id) => tx("trash", "readwrite", (t) => wrap(t.objectStore("trash").delete(id))),
    async clearTrash(key) {
      await tx("trash", "readwrite", async (t) => {
        const store = t.objectStore("trash");
        for (const item of await wrap(store.index("byKey").getAll(key))) store.delete(item.id);
      });
    },
  };
};

// Same interface, kept in memory (tests, and browsers where IndexedDB is blocked).
export const createMemoryStore = () => {
  const connections = new Map();
  let trash = [];
  return {
    get: async (key) => connections.get(key) || null,
    put: async (record) => void connections.set(record.key, record),
    remove: async (key) => void connections.delete(key),
    listTrash: async (key) => trash.filter((item) => item.key === key).sort((a, b) => b.at - a.at),
    async addTrash(key, item) {
      const record = { id: newId(), key, at: Date.now(), ...item };
      trash.push(record);
      const keep = new Set(prune(trash.filter((x) => x.key === key)).map((x) => x.id));
      trash = trash.filter((x) => x.key !== key || keep.has(x.id));
      return record;
    },
    removeTrash: async (id) => void (trash = trash.filter((item) => item.id !== id)),
    clearTrash: async (key) => void (trash = trash.filter((item) => item.key !== key)),
  };
};

export const connectionKey = (namespace, projectId) => `${namespace}:${projectId}`;
