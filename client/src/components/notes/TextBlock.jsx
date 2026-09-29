import { renderInlineMarkdown } from './inlineMarkdown.jsx';

export default function TextBlock({ content = '' }) {
  const paragraphs = content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div className="note-block-text">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{renderInlineMarkdown(paragraph, `text-${index}`)}</p>
      ))}
    </div>
  );
}
