import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import styles from './Accordion.module.css';

/**
 * Generic accordion. Only one item is open at a time.
 *
 * Deliberately does NOT unmount closed panels (no conditional rendering) —
 * they're always present in the DOM and only visually collapsed via CSS.
 * That keeps the content crawlable/readable in the page source even while
 * closed, which matters since this is replacing a full page's worth of
 * indexable content.
 *
 * items: [{ id, question, answer }]
 */
const Accordion = ({ items, defaultOpenId = null }) => {
  const [openId, setOpenId] = useState(defaultOpenId);

  return (
    <div className={styles.accordion}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        const triggerId = `${item.id}-trigger`;
        const panelId = `${item.id}-panel`;

        return (
          <div className={styles.item} key={item.id}>
            <h3 className={styles.heading}>
              <button
                type="button"
                id={triggerId}
                className={styles.trigger}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
              >
                <span className={styles.question}>{item.question}</span>
                <span className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`} aria-hidden="true">
                  {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              className={`${styles.panelOuter} ${isOpen ? styles.open : ''}`}
            >
              <div className={styles.panelInner}>
                <div className={styles.panelContent}>{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;
