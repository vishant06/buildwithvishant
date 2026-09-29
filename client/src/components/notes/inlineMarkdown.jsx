// Lightweight inline Markdown -> React renderer. Deliberately supports only
// a handful of common tokens (bold, italic, inline code, links) — enough for
// pasted notes and AI replies to look right without pulling in a full
// Markdown/HTML rendering pipeline. Everything stays as real React text
// nodes/elements, so this can never execute injected HTML.

const BLOCK_TOKEN = /(\*\*.+?\*\*|__.+?__|`[^`]+`|\[.+?\]\(\S+?\))/g;
const ITALIC_TOKEN = /(\*[^*\n]+?\*|_[^_\n]+?_)/g;

const renderItalics = (text, keyPrefix) =>
  text
    .split(ITALIC_TOKEN)
    .filter((part) => part !== '')
    .map((part, index) => {
      if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) {
        return <em key={`${keyPrefix}-i-${index}`}>{part.slice(1, -1)}</em>;
      }
      return part;
    });

export const renderInlineMarkdown = (text, keyPrefix = 'inline') => {
  if (!text) return null;

  return text
    .split(BLOCK_TOKEN)
    .filter((part) => part !== '')
    .flatMap((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (/^\*\*.+\*\*$/.test(part) || /^__.+__$/.test(part)) {
        return [<strong key={key}>{part.slice(2, -2)}</strong>];
      }
      if (/^`[^`]+`$/.test(part)) {
        return [
          <code key={key} className="inline-code">
            {part.slice(1, -1)}
          </code>
        ];
      }
      const linkMatch = part.match(/^\[(.+?)\]\((\S+?)\)$/);
      if (linkMatch) {
        return [
          <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
            {linkMatch[1]}
          </a>
        ];
      }
      return renderItalics(part, key);
    });
};
