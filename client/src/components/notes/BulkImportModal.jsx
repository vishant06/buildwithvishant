import { FileUp, Sparkles, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { parseMarkdownToBlocks } from './markdownImport.js';
import NoteRenderer from './NoteRenderer.jsx';

const PLACEHOLDER = `# Node.js Introduction

Node.js is a JavaScript runtime built on Chrome's V8 engine.

## Features
- Fast
- Scalable
- Event-driven

\`\`\`javascript
console.log("Hello, Node.js!");
\`\`\`

\`\`\`output
Hello, Node.js!
\`\`\``;

export default function BulkImportModal({ onImport, onClose }) {
  const [raw, setRaw] = useState('');
  const [parsedBlocks, setParsedBlocks] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setError('Please upload a .md, .markdown or .txt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRaw(String(reader.result || ''));
      setParsedBlocks(null);
      setError('');
    };
    reader.onerror = () => setError('That file could not be read. Please try again.');
    reader.readAsText(file);
  };

  const parse = () => {
    if (!raw.trim()) {
      setError('Paste or upload some notes first.');
      return;
    }
    const blocks = parseMarkdownToBlocks(raw);
    if (blocks.length === 0) {
      setError('No content could be recognized in that text.');
      setParsedBlocks(null);
      return;
    }
    setParsedBlocks(blocks);
    setError('');
  };

  const clearAll = () => {
    setRaw('');
    setParsedBlocks(null);
    setError('');
  };

  const confirmImport = () => {
    if (!parsedBlocks || parsedBlocks.length === 0) return;
    onImport(parsedBlocks);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Bulk import notes">
      <div className="modal-panel bulk-import-modal">
        <div className="modal-header">
          <h2>Bulk Import Notes</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close bulk import">
            <X size={18} />
          </button>
        </div>

        <p className="bulk-import-hint">
          Paste a complete Markdown note below (or upload a .md/.txt file), then parse it into blocks.
          Headings, paragraphs, fenced code (use <code className="inline-code">```output</code> for an
          Output block), bullet/numbered lists, blockquote callouts, images, tables and{' '}
          <code className="inline-code">---</code> dividers are detected automatically.
        </p>

        <div className="bulk-import-body">
          <div className="bulk-import-source">
            <div className="bulk-import-toolbar">
              <label className="btn ghost small">
                <FileUp size={14} /> Upload .md / .txt
                <input ref={fileInputRef} type="file" accept=".md,.markdown,.txt" onChange={handleFile} hidden />
              </label>
              <button type="button" className="btn ghost small" onClick={clearAll}>
                <Trash2 size={14} /> Clear
              </button>
            </div>
            <textarea
              className="bulk-import-textarea"
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value);
                setParsedBlocks(null);
              }}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              aria-label="Paste Markdown notes"
            />
            <button type="button" className="btn primary" onClick={parse}>
              <Sparkles size={16} /> Parse Notes
            </button>
            {error && <p className="notice error">{error}</p>}
          </div>

          <div className="bulk-import-preview">
            <span className="block-editor-section-label">Preview {parsedBlocks ? `(${parsedBlocks.length} block${parsedBlocks.length === 1 ? '' : 's'})` : ''}</span>
            {parsedBlocks && parsedBlocks.length > 0 ? (
              <div className="note-editor-preview bulk-import-preview-panel">
                <NoteRenderer note={{ blocks: parsedBlocks }} />
              </div>
            ) : (
              <p className="note-editor-preview-empty">Click "Parse Notes" to see a preview here.</p>
            )}
          </div>
        </div>

        <div className="actions modal-actions">
          <button type="button" className="btn primary" onClick={confirmImport} disabled={!parsedBlocks || parsedBlocks.length === 0}>
            Import Blocks
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
