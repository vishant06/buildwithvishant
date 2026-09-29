import { ChevronDown, FileUp, Plus } from 'lucide-react';
import { useState } from 'react';
import BlockEditorItem from './BlockEditorItem.jsx';
import { BLOCK_TYPES, createBlock } from './blockTypes.js';

export default function BlockEditor({ blocks, onChange, onBulkImportClick }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const addBlock = (type) => {
    onChange([...blocks, createBlock(type)]);
    setPickerOpen(false);
  };

  const updateBlock = (index, next) => {
    const copy = blocks.slice();
    copy[index] = next;
    onChange(copy);
  };

  const removeBlock = (index) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const duplicateBlock = (index) => {
    const copy = blocks.slice();
    copy.splice(index + 1, 0, JSON.parse(JSON.stringify(blocks[index])));
    onChange(copy);
  };

  const moveBlock = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const copy = blocks.slice();
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  };

  return (
    <div className="block-editor">
      {blocks.length === 0 && (
        <p className="block-editor-empty">No content blocks yet — use "Add Block" below to start writing.</p>
      )}

      {blocks.map((block, index) => (
        <BlockEditorItem
          key={index}
          block={block}
          index={index}
          total={blocks.length}
          onChange={(next) => updateBlock(index, next)}
          onRemove={() => removeBlock(index)}
          onDuplicate={() => duplicateBlock(index)}
          onMoveUp={() => moveBlock(index, -1)}
          onMoveDown={() => moveBlock(index, 1)}
        />
      ))}

      <div className="block-editor-toolbar">
        <div className="block-add-wrap">
          <button type="button" className="btn ghost" onClick={() => setPickerOpen((value) => !value)}>
            <Plus size={16} /> Add Block <ChevronDown size={14} />
          </button>
          {pickerOpen && (
            <div className="block-add-menu" role="menu">
              {BLOCK_TYPES.map(({ type, label }) => (
                <button type="button" key={type} onClick={() => addBlock(type)} role="menuitem">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {onBulkImportClick && (
          <button type="button" className="btn ghost" onClick={onBulkImportClick}>
            <FileUp size={16} /> Bulk Import
          </button>
        )}
      </div>
    </div>
  );
}
