// Builds the table of contents for a SINGLE note from its own heading
// blocks — never from the list of other notes. Pure function of `note`, so
// NoteDetail (to render the left TOC) and NoteRenderer (to assign matching
// ids to the actual heading elements) can each call it independently and
// always get the identical, stably-ordered result for the same note.

// Matches the inline tokens inlineMarkdown.jsx renders (bold, italic,
// inline code, links) so a heading like "**Variables** in `python`" becomes
// the plain label "Variables in python" in the sidebar.
const stripInlineMarkdown = (text) =>
  String(text || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[(.+?)\]\(\S+?\)/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (text) => {
  const base = String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'section';
};

// Same heading source NoteRenderer switches on: structured `blocks`
// (type: 'heading') for the block editor, or "## Heading" lines inside the
// legacy `content` string for notes that predate it. Both read `note.blocks`
// / `note.content` directly and in document order, so the id assigned here
// to the Nth heading always lines up with the Nth heading NoteRenderer
// actually renders.
const collectRawHeadings = (note) => {
  if (note?.blocks?.length) {
    return note.blocks
      .filter((block) => block.type === 'heading')
      .map((block) => ({
        level: Math.min(Math.max(Number(block.level) || 2, 1), 4),
        text: stripInlineMarkdown(block.content)
      }));
  }

  if (note?.content) {
    const headings = [];
    note.content.split('\n').forEach((line) => {
      const match = line.match(/^(#{1,4})\s+(.*)/);
      if (match) {
        headings.push({ level: match[1].length, text: stripInlineMarkdown(match[2]) });
      }
    });
    return headings;
  }

  return [];
};

// [{ id, text, level }] in document order. Ids are slugified from the
// heading text, with a numeric suffix (-2, -3, ...) added for duplicates so
// every id is unique and stable across re-renders of the same note.
export const buildNoteToc = (note) => {
  const seen = new Map();

  return collectRawHeadings(note)
    .filter((heading) => heading.text)
    .map((heading) => {
      const base = slugify(heading.text);
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return { id: count === 0 ? base : `${base}-${count}`, text: heading.text, level: heading.level };
    });
};
