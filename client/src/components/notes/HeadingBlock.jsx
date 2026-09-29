import { renderInlineMarkdown } from './inlineMarkdown.jsx';

// `id` is the anchor the left table-of-contents links to (see noteToc.js /
// NoteRenderer, which assign it) — undefined is fine for callers that don't
// need this heading to be a jump target.
export default function HeadingBlock({ level = 2, content = '', id }) {
  const Tag = `h${Math.min(Math.max(Number(level) || 2, 1), 4)}`;
  return <Tag id={id} className="note-block-heading">{renderInlineMarkdown(content, 'heading')}</Tag>;
}
