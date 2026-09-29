import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { BLOCK_TYPES, CALLOUT_TYPES, CODE_LANGUAGE_LABELS } from './blockTypes.js';

const TYPE_LABEL = Object.fromEntries(BLOCK_TYPES.map(({ type, label }) => [type, label]));

export default function BlockEditorItem({ block, index, total, onChange, onRemove, onDuplicate, onMoveUp, onMoveDown }) {
  const set = (patch) => onChange({ ...block, ...patch });

  const setListItem = (itemIndex, value) => {
    const items = block.items.slice();
    items[itemIndex] = value;
    set({ items });
  };
  const addListItem = () => set({ items: [...block.items, ''] });
  const removeListItem = (itemIndex) => set({ items: block.items.filter((_, i) => i !== itemIndex) });

  const setHeader = (colIndex, value) => {
    const headers = block.headers.slice();
    headers[colIndex] = value;
    set({ headers });
  };
  const addColumn = () =>
    set({
      headers: [...block.headers, `Column ${block.headers.length + 1}`],
      rows: block.rows.map((row) => ({ cells: [...row.cells, ''] }))
    });
  const removeColumn = (colIndex) =>
    set({
      headers: block.headers.filter((_, i) => i !== colIndex),
      rows: block.rows.map((row) => ({ cells: row.cells.filter((_, i) => i !== colIndex) }))
    });
  const addRow = () => set({ rows: [...block.rows, { cells: block.headers.map(() => '') }] });
  const removeRow = (rowIndex) => set({ rows: block.rows.filter((_, i) => i !== rowIndex) });
  const setCell = (rowIndex, colIndex, value) => {
    const rows = block.rows.map((row, i) => {
      if (i !== rowIndex) return row;
      const cells = row.cells.slice();
      cells[colIndex] = value;
      return { cells };
    });
    set({ rows });
  };

  return (
    <div className="block-editor-item">
      <div className="block-editor-item-bar">
        <span className="block-editor-item-label">{TYPE_LABEL[block.type] || block.type}</span>
        <div className="block-editor-item-controls">
          <button type="button" className="icon-btn" onClick={onMoveUp} disabled={index === 0} aria-label="Move block up">
            <ArrowUp size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={onMoveDown} disabled={index === total - 1} aria-label="Move block down">
            <ArrowDown size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={onDuplicate} aria-label="Duplicate block">
            <Copy size={15} />
          </button>
          <button type="button" className="icon-btn danger" onClick={onRemove} aria-label="Delete block">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="block-editor-item-body">
        {block.type === 'heading' && (
          <div className="block-editor-row">
            <select value={block.level} onChange={(event) => set({ level: Number(event.target.value) })} aria-label="Heading level">
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
            </select>
            <input value={block.content} onChange={(event) => set({ content: event.target.value })} placeholder="Heading text" />
          </div>
        )}

        {block.type === 'text' && (
          <textarea
            value={block.content}
            onChange={(event) => set({ content: event.target.value })}
            placeholder="Write a paragraph of explanation..."
            rows={4}
          />
        )}

        {block.type === 'code' && (
          <>
            <select value={block.language} onChange={(event) => set({ language: event.target.value })} aria-label="Code language">
              {Object.entries(CODE_LANGUAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <textarea
              className="block-editor-code"
              value={block.content}
              onChange={(event) => set({ content: event.target.value })}
              placeholder="Paste or write code here..."
              rows={8}
              spellCheck={false}
            />
          </>
        )}

        {block.type === 'output' && (
          <textarea
            className="block-editor-code"
            value={block.content}
            onChange={(event) => set({ content: event.target.value })}
            placeholder="Expected console/terminal output..."
            rows={4}
            spellCheck={false}
          />
        )}

        {(block.type === 'bulletList' || block.type === 'numberedList') && (
          <div className="block-editor-list">
            {block.items.map((item, itemIndex) => (
              <div className="block-editor-list-row" key={itemIndex}>
                <input
                  value={item}
                  onChange={(event) => setListItem(itemIndex, event.target.value)}
                  placeholder={`Item ${itemIndex + 1}`}
                />
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => removeListItem(itemIndex)}
                  aria-label="Remove list item"
                  disabled={block.items.length <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn ghost small" onClick={addListItem}>
              + Add Item
            </button>
          </div>
        )}

        {block.type === 'callout' && (
          <>
            <select value={block.calloutType} onChange={(event) => set({ calloutType: event.target.value })} aria-label="Callout type">
              {CALLOUT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            <textarea
              value={block.content}
              onChange={(event) => set({ content: event.target.value })}
              placeholder="Callout message..."
              rows={3}
            />
          </>
        )}

        {block.type === 'image' && (
          <div className="block-editor-col">
            <input value={block.url} onChange={(event) => set({ url: event.target.value })} placeholder="Image URL (https://...)" />
            <input value={block.alt} onChange={(event) => set({ alt: event.target.value })} placeholder="Alt text (for accessibility)" />
            <input value={block.caption} onChange={(event) => set({ caption: event.target.value })} placeholder="Caption (optional)" />
            {block.url && <img className="block-editor-image-preview" src={block.url} alt="" />}
          </div>
        )}

        {block.type === 'table' && (
          <div className="block-editor-table">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header, colIndex) => (
                      <th key={colIndex}>
                        <input value={header} onChange={(event) => setHeader(colIndex, event.target.value)} />
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => removeColumn(colIndex)}
                          disabled={block.headers.length <= 1}
                          aria-label="Remove column"
                        >
                          <Trash2 size={12} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.cells.map((cell, colIndex) => (
                        <td key={colIndex}>
                          <input value={cell} onChange={(event) => setCell(rowIndex, colIndex, event.target.value)} />
                        </td>
                      ))}
                      <td className="block-editor-table-row-actions">
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => removeRow(rowIndex)}
                          disabled={block.rows.length <= 1}
                          aria-label="Remove row"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="block-editor-table-actions">
              <button type="button" className="btn ghost small" onClick={addRow}>
                + Add Row
              </button>
              <button type="button" className="btn ghost small" onClick={addColumn}>
                + Add Column
              </button>
            </div>
          </div>
        )}

        {block.type === 'divider' && <p className="block-editor-hint">A horizontal divider will appear here.</p>}
      </div>
    </div>
  );
}
