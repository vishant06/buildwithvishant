import { useMemo } from 'react';
import useScrollSpy from '../../hooks/useScrollSpy.js';

// Left column: table of contents for the CURRENTLY OPEN note only — built
// from that note's own headings (see noteToc.js), never from the list of
// other notes. `containerRef` is the article DOM node NoteRenderer renders
// into; the active section is tracked by observing the real heading
// elements inside it as the reader scrolls.
export default function NoteToc({ toc, noteTitle, containerRef, loading, onNavigate }) {
  const ids = useMemo(() => toc.map((item) => item.id), [toc]);
  const activeId = useScrollSpy(containerRef, ids);

  const handleClick = (event, id) => {
    event.preventDefault();
    const target = containerRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onNavigate?.();
  };

  return (
    <div className="note-toc">
      <div className="note-toc-head">
        <h2>On this page</h2>
        {noteTitle && <p className="note-toc-subject">{noteTitle}</p>}
      </div>

      <nav className="note-toc-list" aria-label="Table of contents">
        {loading ? (
          <div className="note-topics-skeleton" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} style={{ width: `${88 - (index % 4) * 14}%` }} />
            ))}
          </div>
        ) : toc.length === 0 ? (
          <p className="note-topics-empty">No sections available.</p>
        ) : (
          <ul>
            {toc.map((item) => (
              <li key={item.id} className={`note-toc-item note-toc-level-${item.level}`}>
                <a
                  href={`#${item.id}`}
                  className={`note-toc-link${item.id === activeId ? ' is-active' : ''}`}
                  aria-current={item.id === activeId ? 'true' : undefined}
                  onClick={(event) => handleClick(event, item.id)}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
