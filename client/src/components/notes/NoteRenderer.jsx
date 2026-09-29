import { useMemo } from 'react';
import CalloutBlock from './CalloutBlock.jsx';
import CodeBlock from './CodeBlock.jsx';
import DividerBlock from './DividerBlock.jsx';
import HeadingBlock from './HeadingBlock.jsx';
import ImageBlock from './ImageBlock.jsx';
import ListBlock from './ListBlock.jsx';
import { buildNoteToc } from './noteToc.js';
import OutputBlock from './OutputBlock.jsx';
import TableBlock from './TableBlock.jsx';
import TextBlock from './TextBlock.jsx';

const LEGACY_HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' };

// Note without structured `blocks`: a single `content` string using a plain
// "## Heading" convention, plus a separate `codeExamples` array. Kept so
// those notes keep displaying (and, now, keep their own table of contents)
// without needing a database migration.
const LegacyNote = ({ note }) => {
  const toc = useMemo(() => buildNoteToc(note), [note]);
  let headingIndex = 0;

  return (
    <div className="note-blocks">
      {note.content && (
        <div className="note-block-text">
          {note.content.split('\n').map((line, index) => {
            if (!line.trim()) return null;

            const match = line.match(/^(#{1,4})\s+(.*)/);
            if (match) {
              const Tag = LEGACY_HEADING_TAGS[match[1].length] || 'h2';
              const id = toc[headingIndex]?.id;
              headingIndex += 1;
              return (
                <Tag key={index} id={id} className="note-block-heading">
                  {match[2]}
                </Tag>
              );
            }

            return <p key={index}>{line}</p>;
          })}
        </div>
      )}

      {(note.codeExamples || []).map((example, index) => (
        <CodeBlock
          key={index}
          language={example.language || 'javascript'}
          content={example.code}
          title={example.title}
          runnable
        />
      ))}
    </div>
  );
};

export default function NoteRenderer({ note }) {
  const toc = useMemo(() => buildNoteToc(note), [note]);

  if (!note) return null;

  const blocks = note.blocks || [];

  if (blocks.length === 0) {
    return <LegacyNote note={note} />;
  }

  let headingIndex = 0;

  return (
    <div className="note-blocks">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case 'heading': {
            const id = toc[headingIndex]?.id;
            headingIndex += 1;
            return (
              <HeadingBlock
                key={key}
                id={id}
                level={block.level}
                content={block.content}
              />
            );
          }

          case 'text':
            return <TextBlock key={key} content={block.content} />;

          case 'code':
            return (
              <CodeBlock
                key={key}
                language={block.language}
                content={block.content}
                runnable
              />
            );

          case 'output':
            return <OutputBlock key={key} content={block.content} />;

          case 'bulletList':
            return (
              <ListBlock
                key={key}
                ordered={false}
                items={block.items}
              />
            );

          case 'numberedList':
            return (
              <ListBlock
                key={key}
                ordered
                items={block.items}
              />
            );

          case 'callout':
            return (
              <CalloutBlock
                key={key}
                calloutType={block.calloutType}
                content={block.content}
              />
            );

          case 'image':
            return (
              <ImageBlock
                key={key}
                url={block.url}
                alt={block.alt}
                caption={block.caption}
              />
            );

          case 'table':
            return (
              <TableBlock
                key={key}
                headers={block.headers}
                rows={block.rows}
              />
            );

          case 'divider':
            return <DividerBlock key={key} />;

          default:
            return null;
        }
      })}
    </div>
  );
}