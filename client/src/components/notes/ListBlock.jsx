import { renderInlineMarkdown } from './inlineMarkdown.jsx';

export default function ListBlock({ ordered = false, items = [] }) {
  const visibleItems = (items || []).filter((item) => item && item.trim());
  if (visibleItems.length === 0) return null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className="note-block-list">
      {visibleItems.map((item, index) => (
        <li key={index}>{renderInlineMarkdown(item, `list-${index}`)}</li>
      ))}
    </Tag>
  );
}
