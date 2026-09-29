import request from './api.js';

// Small in-memory cache so moving between notes in the reader doesn't
// re-download the notes index (sidebar) or a note that was just opened.
// Entries expire quickly so edits made in the admin panel show up soon.
const INDEX_TTL = 60_000;
const NOTE_TTL = 60_000;

let indexCache = null; // { promise, at }
const noteCache = new Map(); // slug -> { promise, at }

const fresh = (entry, ttl) => entry && Date.now() - entry.at < ttl;

export const getNotesIndex = () => {
  if (!fresh(indexCache, INDEX_TTL)) {
    const entry = { at: Date.now() };
    entry.promise = request('/notes').catch((error) => {
      if (indexCache === entry) indexCache = null;
      throw error;
    });
    indexCache = entry;
  }
  return indexCache.promise;
};

export const getNoteBySlug = (slug) => {
  const cached = noteCache.get(slug);
  if (!fresh(cached, NOTE_TTL)) {
    const entry = { at: Date.now() };
    entry.promise = request(`/notes/${encodeURIComponent(slug)}`).catch((error) => {
      if (noteCache.get(slug) === entry) noteCache.delete(slug);
      throw error;
    });
    noteCache.set(slug, entry);
    return entry.promise;
  }
  return cached.promise;
};

// ---------------------------------------------------------------------------
// Pure helpers used by the reader sidebars. No hardcoded categories — every
// group comes from the `category` each note already has.
// ---------------------------------------------------------------------------

const categoryKey = (note) => String(note.category || 'General').trim().toLowerCase();
const categoryLabel = (note) => String(note.category || 'General').trim() || 'General';

// Categories A→Z; inside a category, oldest first (reads like a course).
export const groupNotesByCategory = (notes) => {
  const groups = new Map();
  notes.forEach((note) => {
    const key = categoryKey(note);
    if (!groups.has(key)) groups.set(key, { key, label: categoryLabel(note), notes: [] });
    groups.get(key).notes.push(note);
  });
  const list = [...groups.values()];
  list.forEach((group) =>
    group.notes.sort(
      (a, b) =>
        new Date(a.createdAt || 0) - new Date(b.createdAt || 0) ||
        String(a.title).localeCompare(String(b.title)),
    ),
  );
  return list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};

export const flattenGroups = (groups) => groups.flatMap((group) => group.notes);

export const noteCategoryKey = categoryKey;

export const noteMatchesQuery = (note, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${note.title} ${note.description} ${note.category} ${(note.tags || []).join(' ')}`
    .toLowerCase()
    .includes(q);
};

// Related = same category and/or shared tags. Falls back to other notes so the
// sidebar is never empty when there are enough notes overall.
export const getRelatedAndOther = (notes, current, { relatedLimit = 5, otherLimit = 5 } = {}) => {
  if (!current) return { related: [], other: [] };
  const currentTags = new Set((current.tags || []).map((tag) => tag.toLowerCase()));
  const currentCategory = categoryKey(current);

  const scored = notes
    .filter((note) => note.slug !== current.slug)
    .map((note) => {
      const sharedTags = (note.tags || []).filter((tag) => currentTags.has(tag.toLowerCase())).length;
      const score = (categoryKey(note) === currentCategory ? 3 : 0) + sharedTags;
      return { note, score };
    });

  const related = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.note.createdAt || 0) - new Date(a.note.createdAt || 0))
    .slice(0, relatedLimit)
    .map((item) => item.note);

  const relatedSlugs = new Set(related.map((note) => note.slug));
  const other = scored
    .map((item) => item.note)
    .filter((note) => !relatedSlugs.has(note.slug))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, otherLimit);

  return { related, other };
};
