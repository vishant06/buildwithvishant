import { ArrowUp } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Auto-growing message box. Enter sends, Shift+Enter adds a line, IME composition is respected.
const Composer = forwardRef(function Composer({ value, onChange, onSend, disabled, loading, placeholder, hint }, ref) {
  const box = useRef(null);
  useImperativeHandle(ref, () => ({ focus: () => box.current?.focus() }));

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [value]);

  const canSend = !disabled && !loading && value.trim().length > 0;
  return (
    <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); if (canSend) onSend(); }}>
      <div className="ai-composer-box">
        <textarea
          ref={box}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          aria-label="Message the assistant"
          disabled={disabled}
          maxLength={8000}
        />
        <button type="submit" className="ai-send" disabled={!canSend} aria-label={loading ? 'Waiting for the reply' : 'Send message'}>
          <ArrowUp size={18} />
        </button>
      </div>
      {hint && <p className="ai-hint">{hint}</p>}
    </form>
  );
});

export default Composer;
