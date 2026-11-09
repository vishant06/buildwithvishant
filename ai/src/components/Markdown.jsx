import { useMemo } from 'react';
import CodeBlock from '@client/components/notes/CodeBlock.jsx';
import { normalizeLanguage } from '@client/components/notes/blockTypes.js';
import { renderInlineMarkdown as inline } from '@client/components/notes/inlineMarkdown.jsx';
import { parseMarkdown } from '../lib/markdownBlocks.js';

// Renders an assistant reply. Structure comes from the pure parser; React escapes all text, so model
// output can never inject markup. Code fences reuse the site's CodeBlock (highlighting, copy, run).
export default function Markdown({ text }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="md">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case 'code':
            return <CodeBlock key={key} language={normalizeLanguage(block.language)} content={block.code} />;
          case 'heading': {
            const Tag = `h${block.level + 1}`; // h2-h5: the page already has an h1
            return <Tag key={key} className="md-h">{inline(block.text, key)}</Tag>;
          }
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return <Tag key={key} className="md-list" start={block.ordered && block.start !== 1 ? block.start : undefined}>{block.items.map((item, i) => <li key={i}>{inline(item, `${key}-${i}`)}</li>)}</Tag>;
          }
          case 'quote':
            return <blockquote key={key}>{inline(block.text, key)}</blockquote>;
          case 'hr':
            return <hr key={key} />;
          case 'table':
            return (
              <div className="md-table" key={key} role="region" aria-label="Table" tabIndex={0}>
                <table>
                  <thead><tr>{block.header.map((cell, i) => <th key={i} style={{ textAlign: block.align[i] }}>{inline(cell, `${key}-h${i}`)}</th>)}</tr></thead>
                  <tbody>{block.rows.map((row, r) => <tr key={r}>{block.header.map((_, c) => <td key={c} style={{ textAlign: block.align[c] }}>{inline(row[c] ?? '', `${key}-${r}-${c}`)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{inline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}
