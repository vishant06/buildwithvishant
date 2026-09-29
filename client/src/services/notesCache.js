import request from './api.js';

// Small in-memory cache so moving between notes in the reader doesn't refetch
// the notes list (used by both sidebars) or a note that was just read. Entries
// expire after a minute so edits made in the admin dashboard show up quickly,
// and the dashboard also calls `invalidateNotesCache()` after save/delete.
const TTL_MS = 60_000;

let indexEntry = null;
const noteEntries = new Map();

const isFresh = (entry) => Boolean(entry) && Date.now() - entry.time < TTL_MS;

const createEntry = (path, normalize) => {
  const entry = { time: Date.now(), data: null, promise: null };
  entry.promise = request(path).then((data) => {
    entry.data = normalize(data);
    return entry.data;
  });
  return entry;
};

export const peekNotesIndex = () => (isFresh(indexEntry) ? indexEntry.data : null);

export const loadNotesIndex = () => {
  if (isFresh(indexEntry)) return indexEntry.promise;
  const entry = createEntry('/notes', (data) => (Array.isArray(data) ? data : []));
  entry.promise = entry.promise.catch((error) => {
    if (indexEntry === entry) indexEntry = null;
    throw error;
  });
  indexEntry = entry;
  return entry.promise;
};

export const peekNote = (slug) => {
  const entry = noteEntries.get(slug);
  return isFresh(entry) ? entry.data : null;
};

export const loadNote = (slug) => {
  const existing = noteEntries.get(slug);
  if (isFresh(existing)) return existing.promise;
  const entry = createEntry(`/notes/${encodeURIComponent(slug)}`, (data) => data);
  entry.promise = entry.promise.catch((error) => {
    if (noteEntries.get(slug) === entry) noteEntries.delete(slug);
    throw error;
  });
  noteEntries.set(slug, entry);
  return entry.promise;
};

export const invalidateNotesCache = () => {
  indexEntry = null;
  noteEntries.clear();
};
