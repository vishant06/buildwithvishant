import CalloutBlock from './CalloutBlock.jsx';
import CodeBlock from './CodeBlock.jsx';
import DividerBlock from './DividerBlock.jsx';
import HeadingBlock from './HeadingBlock.jsx';
import ImageBlock from './ImageBlock.jsx';
import ListBlock from './ListBlock.jsx';
import OutputBlock from './OutputBlock.jsx';
import TableBlock from './TableBlock.jsx';
import TextBlock from './TextBlock.jsx';

// Renders a note that predates the block editor: a single `content` string
// (with a light "## Heading" convention already in use) plus a separate
// `codeExamples` array. Kept so those notes keep displaying correctly
// without needing a database migration.
const LegacyNote = ({ note }) => (
  <div className="note-blocks">
    {note.content && (
      <div className="note-block-text">
        {note.content.split('\n').map((line, index) => {
          if (!line.trim()) return null;
          if (line.startsWith('#### ')) return <h4 key={index}>{line.slice(5)}</h4>;
          if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>;
          if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
          return <p key={index}>{line}</p>;
        })}
      </div>
    )}
    {(note.codeExamples || []).map((example, index) => (
      <CodeBlock key={index} language={example.language || 'javascript'} content={example.code} title={example.title} runnable />
    ))}
  </div>
);

export default function NoteRenderer({ note }) {
  if (!note) return null;
  const blocks = note.blocks || [];

  if (blocks.length === 0) {
    return <LegacyNote note={note} />;
  }

  return (
    <div className="note-blocks">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={key} level={block.level} content={block.content} />;
          case 'text':
            return <TextBlock key={key} content={block.content} />;
          case 'code':
            return <CodeBlock key={key} language={block.language} content={block.content} runnable />;
          case 'output':
            return <OutputBlock key={key} content={block.content} />;
          case 'bulletList':
            return <ListBlock key={key} ordered={false} items={block.items} />;
          case 'numberedList':
            return <ListBlock key={key} ordered items={block.items} />;
          case 'callout':
            return <CalloutBlock key={key} calloutType={block.calloutType} content={block.content} />;
          case 'image':
            return <ImageBlock key={key} url={block.url} alt={block.alt} caption={block.caption} />;
          case 'table':
            return <TableBlock key={key} headers={block.headers} rows={block.rows} />;
          case 'divider':
            return <DividerBlock key={key} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
