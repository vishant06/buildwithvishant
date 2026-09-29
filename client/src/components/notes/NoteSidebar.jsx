import { ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { filterGroups } from './noteNavigation.js';

// Left column: every published note, grouped by category, with search.
// `groups` comes from groupNotesByCategory(); the active note's category is
// open by default and the active link is kept in view.
export default function NoteSidebar({ groups, activeSlug, activeKey, loading, error, onNavigate }) {
  const [query, setQuery] = useState('');
  const [openMap, setOpenMap] = useState({});
  const listRef = useRef(null);
  const searching = query.trim().length > 0;

  const visibleGroups = useMemo(() => filterGroups(groups, query), [groups, query]);

  // Opening a note in another category expands that category.
  useEffect(() => {
    if (activeKey) setOpenMap((current) => ({ ...current, [activeKey]: true }));
  }, [activeKey]);

  // Keep the current topic visible inside the sidebar's own scroll area
  // (scrolls only that box, never the page).
  useEffect(() => {
    const box = listRef.current;
    const el = box?.querySelector('[aria-current="page"]');
    if (!box || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = Math.max(0, top - 48);
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 48;
  }, [activeSlug, groups]);

  const isOpen = (group) => searching || (openMap[group.key] ?? group.key === activeKey);
  const toggle = (group) => setOpenMap((current) => ({ ...current, [group.key]: !isOpen(group) }));

  return (
    <div className="note-topics">
      <div className="note-topics-head">
        <h2>Topics</h2>
        <label className="note-topics-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics…"
            aria-label="Search topics"
          />
        </label>
      </div>

      <nav className="note-topics-list" ref={listRef} aria-label="Note topics">
        {loading ? (
          <div className="note-topics-skeleton" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} style={{ width: `${88 - (index % 4) * 14}%` }} />
            ))}
          </div>
        ) : error ? (
          <p className="note-topics-empty">Could not load topics.</p>
        ) : visibleGroups.length === 0 ? (
          <p className="note-topics-empty">{searching ? 'No topics match your search.' : 'No notes published yet.'}</p>
        ) : (
          visibleGroups.map((group) => {
            const open = isOpen(group);
            const panelId = `note-topic-group-${group.key.replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <div className="note-topic-group" key={group.key}>
                <button
                  type="button"
                  className="note-topic-group-toggle"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(group)}
                >
                  <ChevronRight size={14} className={open ? 'is-open' : ''} aria-hidden="true" />
                  <span>{group.category}</span>
                  <small>{group.notes.length}</small>
                </button>
                {open && (
                  <ul id={panelId}>
                    {group.notes.map((note) => {
                      const active = note.slug === activeSlug;
                      return (
                        <li key={note._id || note.slug}>
                          <Link
                            to={`/notes/${note.slug}`}
                            className={`note-topic-link${active ? ' is-active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                            onClick={onNavigate}
                          >
                            {note.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
