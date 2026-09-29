import { renderInlineMarkdown } from './inlineMarkdown.jsx';

export default function HeadingBlock({ level = 2, content = '' }) {
  const Tag = `h${Math.min(Math.max(Number(level) || 2, 1), 4)}`;
  return <Tag className="note-block-heading">{renderInlineMarkdown(content, 'heading')}</Tag>;
}
