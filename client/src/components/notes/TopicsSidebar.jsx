import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupNotesByCategory, noteCategoryKey, noteMatchesQuery } from '../../services/notesApi.js';

// Left column of the notes reader. Built entirely from the published notes
// returned by the API, grouped by each note's own `category`.
export default function TopicsSidebar({ notes, status, activeSlug, activeCategory, open, onClose }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [manuallyOpened, setManuallyOpened] = useState(() => new Set());
  const listRef = useRef(null);
  const activeRef = useRef(null);
  const searching = query.trim().length > 0;

  const groups = useMemo(() => {
    const filtered = notes.filter((note) => noteMatchesQuery(note, query));
    return groupNotesByCategory(filtered);
  }, [notes, query]);

  const activeKey = activeCategory ? noteCategoryKey({ category: activeCategory }) : '';

  // A category is open when: searching, or it holds the active note, or the
  // reader opened it by hand — unless they explicitly collapsed it.
  const isOpen = (key) => {
    if (searching) return true;
    if (collapsed.has(key)) return false;
    return key === activeKey || manuallyOpened.has(key);
  };

  const toggle = (key) => {
    const currentlyOpen = isOpen(key);
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (currentlyOpen) next.add(key);
      else next.delete(key);
      return next;
    });
    setManuallyOpened((prev) => {
      const next = new Set(prev);
      if (currentlyOpen) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Navigating to another note re-expands its category.
  useEffect(() => {
    if (!activeKey) return;
    setCollapsed((prev) => {
      if (!prev.has(activeKey)) return prev;
      const next = new Set(prev);
      next.delete(activeKey);
      return next;
    });
  }, [activeKey, activeSlug]);

  // Keep the active topic visible inside the sidebar without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (!list || !item) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.top < listRect.top + 8 || itemRect.bottom > listRect.bottom - 8) {
      list.scrollTop += itemRect.top - listRect.top - listRect.height / 2 + itemRect.height / 2;
    }
  }, [activeSlug, notes, status, searching]);

  return (
    <aside
      id="notes-topics"
      className={`notes-sidebar notes-topics${open ? ' is-open' : ''}`}
      aria-label="Note topics"
    >
      <div className="notes-sidebar-head">
        <h2>Topics</h2>
        <button type="button" className="notes-sidebar-close" onClick={onClose} aria-label="Close topics">
          <X size={18} />
        </button>
      </div>

      <div className="notes-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
        />
      </div>

      <nav className="notes-topic-list" ref={listRef} aria-label="Notes by topic">
        {status === 'loading' && <p className="notes-side-empty">Loading topics…</p>}
        {status === 'error' && <p className="notes-side-empty">Couldn’t load topics.</p>}
        {status === 'ready' && groups.length === 0 && (
          <p className="notes-side-empty">{searching ? 'No notes match your search.' : 'No notes yet.'}</p>
        )}

        {groups.map((group) => {
          const groupOpen = isOpen(group.key);
          const panelId = `notes-group-${group.key.replace(/[^a-z0-9]+/g, '-')}`;
          return (
            <div className="notes-group" key={group.key}>
              <button
                type="button"
                className="notes-group-toggle"
                onClick={() => toggle(group.key)}
                aria-expanded={groupOpen}
                aria-controls={panelId}
              >
                <span>{group.label}</span>
                <span className="notes-group-count">{group.notes.length}</span>
                <ChevronDown size={15} className={groupOpen ? 'is-open' : ''} aria-hidden="true" />
              </button>
              {groupOpen && (
                <ul id={panelId} className="notes-group-items">
                  {group.notes.map((note) => {
                    const active = note.slug === activeSlug;
                    return (
                      <li key={note._id || note.slug}>
                        <Link
                          ref={active ? activeRef : null}
                          to={`/notes/${note.slug}`}
                          className={`notes-topic-link${active ? ' is-active' : ''}`}
                          aria-current={active ? 'page' : undefined}
                          onClick={onClose}
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
        })}
      </nav>
    </aside>
  );
}
