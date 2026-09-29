import { AlertTriangle, Info, Lightbulb, ShieldAlert } from 'lucide-react';
import { renderInlineMarkdown } from './inlineMarkdown.jsx';

const CONFIG = {
  note: { label: 'Note', icon: Info },
  important: { label: 'Important', icon: ShieldAlert },
  tip: { label: 'Tip', icon: Lightbulb },
  warning: { label: 'Warning', icon: AlertTriangle }
};

export default function CalloutBlock({ calloutType = 'note', content = '' }) {
  if (!content) return null;
  const { label, icon: Icon } = CONFIG[calloutType] || CONFIG.note;
  return (
    <div className={`note-callout note-callout-${calloutType}`}>
      <div className="note-callout-heading">
        <Icon size={16} /> {label}
      </div>
      <p>{renderInlineMarkdown(content, 'callout')}</p>
    </div>
  );
}
