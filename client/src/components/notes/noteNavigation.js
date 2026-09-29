// Pure helpers that turn the flat notes list into the reader's navigation:
// topic groups (left sidebar), previous/next, and related notes (right
// sidebar). Everything is derived from the existing Note fields — `category`,
// `tags`, `createdAt` — so no schema change or migration is needed.

const FALLBACK_CATEGORY = 'General';

const byCreatedAsc = (a, b) =>
  new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.title).localeCompare(String(b.title));

const byCreatedDesc = (a, b) => byCreatedAsc(b, a);

// [{ key, category, notes }] — categories A→Z (case-insensitive, so "dsa" and
// "DSA" share a group), notes inside a category in the order they were
// written, which is the natural reading order for a learning path.
export const groupNotesByCategory = (notes) => {
  const map = new Map();
  notes.forEach((note) => {
    const label = String(note.category || '').trim() || FALLBACK_CATEGORY;
    const key = label.toLowerCase();
    if (!map.has(key)) map.set(key, { key, category: label, notes: [] });
    map.get(key).notes.push(note);
  });
  return [...map.values()]
    .sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }))
    .map((group) => ({ ...group, notes: group.notes.sort(byCreatedAsc) }));
};

export const categoryKey = (note) => (String(note?.category || '').trim() || FALLBACK_CATEGORY).toLowerCase();

// Case-insensitive match of every search word against title, description,
// category and tags.
export const filterGroups = (groups, query) => {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups
    .map((group) => ({
      ...group,
      notes: group.notes.filter((note) => {
        const haystack = `${note.title} ${note.description || ''} ${note.category || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
    }))
    .filter((group) => group.notes.length);
};

// Previous/next in sidebar order (continues into the next category).
export const getPrevNext = (groups, slug) => {
  const flat = groups.flatMap((group) => group.notes);
  const index = flat.findIndex((note) => note.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return { prev: flat[index - 1] || null, next: flat[index + 1] || null };
};

// Related = same category first, then shared tags. "Others" = everything else,
// newest first, so the rail is never empty while other notes exist. The
// current note is never included.
export const getRailNotes = (notes, current, { relatedLimit = 5, otherLimit = 6 } = {}) => {
  if (!current) return { related: [], others: [] };
  const currentTags = new Set((current.tags || []).map((tag) => String(tag).toLowerCase()));
  const currentCategory = categoryKey(current);

  const scored = notes
    .filter((note) => note.slug !== current.slug)
    .map((note) => {
      const sharedTags = (note.tags || []).filter((tag) => currentTags.has(String(tag).toLowerCase())).length;
      const sameCategory = categoryKey(note) === currentCategory;
      return { note, score: (sameCategory ? 10 : 0) + sharedTags };
    });

  const related = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || byCreatedAsc(a.note, b.note))
    .slice(0, relatedLimit)
    .map((item) => item.note);

  const relatedSlugs = new Set(related.map((note) => note.slug));
  const others = scored
    .map((item) => item.note)
    .filter((note) => !relatedSlugs.has(note.slug))
    .sort(byCreatedDesc)
    .slice(0, otherLimit);

  return { related, others };
};
