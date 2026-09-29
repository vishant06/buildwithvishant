<<<<<<< HEAD
import { X } from 'lucide-react';

// Static "Output" block from the note editor — and, with the optional props,
// the result panel shown under a code block after pressing Run.
//   variant  'default' | 'success' | 'error'
//   meta     small status text next to the title (e.g. "Time Limit Exceeded")
//   live     announce changes to screen readers
//   embedded drop the outer border/radius so it can sit inside a code block
//   onClear  shows a close button
export default function OutputBlock({
  content = '',
  title = 'Output',
  variant = 'default',
  meta = '',
  live = false,
  embedded = false,
  onClear
}) {
  const classes = ['note-output-block', variant !== 'default' && `is-${variant}`, embedded && 'is-embedded']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role={live ? (variant === 'error' ? 'alert' : 'status') : undefined}>
      <div className="note-output-bar">
        <span>
          {title}
          {meta && <span className="note-output-meta"> · {meta}</span>}
        </span>
        {onClear && (
          <button type="button" className="note-output-clear" onClick={onClear} aria-label="Clear output" title="Clear output">
            <X size={14} />
          </button>
        )}
      </div>
=======
export default function OutputBlock({ content = '' }) {
  return (
    <div className="note-output-block">
      <div className="note-output-bar">Output</div>
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
      <pre className="note-output-body"><code>{content}</code></pre>
    </div>
  );
}
