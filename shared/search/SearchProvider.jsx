import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bot,
  Code,
  CornerDownLeft,
  FileText,
  FolderGit2,
  Globe,
  Loader2,
  Moon,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import request from '../api/request.js';
import { appHref } from '../auth/sso.js';
import { AI_URL, PLAYGROUND_URL, mainUrl } from '../config/urls.js';
import { useTheme } from '../theme/ThemeContext.jsx';
import './search.css';

const SearchContext = createContext(null);
export const useSearch = () => useContext(SearchContext);

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const CACHE_TTL_MS = 60_000;
const CACHE_LIMIT = 40;
const cache = new Map(); // normalized query -> { at, data }

const readCache = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
};

const writeCache = (key, data) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), data });
};

const isMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
export const shortcutLabel = () => (isMac() ? '⌘K' : 'Ctrl K');

const PAGES = [
  { key: 'page-home', label: 'Home', hint: 'Main site', icon: Globe, main: '/' },
  { key: 'page-notes', label: 'Notes', hint: 'All notes', icon: BookOpen, main: '/notes' },
  { key: 'page-projects', label: 'Projects', hint: 'Things I have built', icon: FolderGit2, main: '/projects' },
  { key: 'page-skills', label: 'Skills', hint: 'Tech stack', icon: FileText, main: '/skills' },
  { key: 'page-resume', label: 'Resume', hint: 'Experience and education', icon: UserRound, main: '/resume' },
];

const GROUP_ORDER = ['Notes', 'Projects', 'Pages', 'Actions'];
const GROUP_ICON = { Notes: BookOpen, Projects: FolderGit2, Pages: FileText, Actions: Code };

export function SearchProvider({ children, app = 'main', onNavigateMain }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  // Ctrl/⌘ + K. Registered in the capture phase so it also wins over
  // editors (Monaco uses Ctrl+K as a chord prefix) and page shortcuts.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const value = useMemo(() => ({ open, openSearch, closeSearch }), [open, openSearch, closeSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {open && <SearchPalette app={app} onClose={closeSearch} onNavigateMain={onNavigateMain} />}
    </SearchContext.Provider>
  );
}

function SearchPalette({ app, onClose, onNavigateMain }) {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState({ notes: [], projects: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const restoreFocusRef = useRef(document.activeElement);

  useEffect(() => {
    inputRef.current?.focus();
    const previous = restoreFocusRef.current;
    return () => previous?.focus?.();
  }, []);

  // Debounced, cancellable, cached lookup against GET /api/search.
  useEffect(() => {
    const term = query.trim();
    setError('');
    if (term.length < MIN_QUERY) {
      setRemote({ notes: [], projects: [] });
      setLoading(false);
      return undefined;
    }

    const key = term.toLowerCase();
    const cached = readCache(key);
    if (cached) {
      setRemote(cached);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await request(`/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const next = { notes: data.notes || [], projects: data.projects || [] };
        writeCache(key, next);
        setRemote(next);
        setLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setRemote({ notes: [], projects: [] });
        setError('Search is unavailable right now.');
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (item) => !term || item.label.toLowerCase().includes(term) || item.hint.toLowerCase().includes(term);

    const actions = [
      app !== 'playground' && { key: 'act-playground', label: 'Open Playground', hint: 'Write and run code', icon: Code, url: appHref(PLAYGROUND_URL) },
      app !== 'ai' && { key: 'act-ai', label: 'Open AI', hint: 'Ask the assistant', icon: Bot, url: appHref(AI_URL) },
      {
        key: 'act-theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        hint: 'Appearance',
        icon: theme === 'dark' ? Sun : Moon,
        run: toggleTheme,
      },
    ].filter(Boolean);

    const built = {
      Notes: remote.notes.map((note) => ({
        key: `note-${note.id}`,
        label: note.title,
        hint: [note.category, note.difficulty].filter(Boolean).join(' · '),
        icon: BookOpen,
        main: `/notes/${note.slug}`,
      })),
      Projects: remote.projects.map((project) => ({
        key: `project-${project.id}`,
        label: project.title,
        hint: project.technologies.slice(0, 3).join(' · '),
        icon: FolderGit2,
        main: `/projects#${project.id}`,
      })),
      Pages: PAGES.filter(matches),
      Actions: actions.filter(matches),
    };

    return GROUP_ORDER.map((name) => ({ name, items: built[name] })).filter((group) => group.items.length > 0);
  }, [query, remote, app, theme, toggleTheme]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => setActive(0), [flat.length, query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, flat]);

  const choose = (item) => {
    onClose();
    if (item.run) return item.run();
    if (item.main) {
      if (onNavigateMain) return onNavigateMain(item.main);
      window.location.assign(mainUrl(item.main));
      return undefined;
    }
    if (item.url) window.location.assign(item.url);
    return undefined;
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flat.length) setActive((index) => (index + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flat.length) setActive((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (event.key === 'Tab') {
      event.preventDefault(); // keep focus inside the palette
    }
  };

  const term = query.trim();
  const searching = term.length >= MIN_QUERY;
  const noContentResults = searching && !loading && !error && remote.notes.length === 0 && remote.projects.length === 0;
  let index = -1;

  return (
    <div className="bwv-search-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bwv-search-dialog" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKeyDown}>
        <div className="bwv-search-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes, projects, pages…"
            aria-label="Search notes, projects and pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="bwv-search-list"
            aria-activedescendant={flat[active] ? `bwv-search-${flat[active].key}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 size={16} className="bwv-spin" aria-label="Searching" />}
          <kbd>Esc</kbd>
        </div>

        <div className="bwv-search-list" id="bwv-search-list" role="listbox" ref={listRef}>
          {error && <p className="bwv-search-empty">{error}</p>}
          {noContentResults && groups.length === 0 && <p className="bwv-search-empty">No results found for “{term}”.</p>}
          {noContentResults && groups.length > 0 && <p className="bwv-search-note">No notes or projects match “{term}”.</p>}
          {!searching && <p className="bwv-search-note">Type to search notes and projects.</p>}

          {groups.map((group) => {
            const GroupIcon = GROUP_ICON[group.name];
            return (
              <div key={group.name} role="group" aria-label={group.name}>
                <p className="bwv-search-group">
                  <GroupIcon size={13} aria-hidden="true" /> {group.name}
                </p>
                {group.items.map((item) => {
                  index += 1;
                  const position = index;
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      id={`bwv-search-${item.key}`}
                      role="option"
                      aria-selected={position === active}
                      data-active={position === active}
                      className="bwv-search-item"
                      onMouseMove={() => position !== active && setActive(position)}
                      onClick={() => choose(item)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span className="bwv-search-label">{item.label}</span>
                      {item.hint && <span className="bwv-search-hint">{item.hint}</span>}
                      {position === active && <CornerDownLeft size={14} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="bwv-search-footer" aria-hidden="true">
          <span><ArrowUp size={12} /><ArrowDown size={12} /> navigate</span>
          <span><CornerDownLeft size={12} /> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

// Navbar button that opens the palette.
export function SearchButton({ className = '' }) {
  const { openSearch } = useSearch();
  return (
    <button type="button" className={`bwv-search-btn ${className}`.trim()} onClick={openSearch} aria-label="Search" title={`Search (${shortcutLabel()})`}>
      <Search size={16} aria-hidden="true" />
      <span className="bwv-search-btn-text">Search</span>
      <kbd>{shortcutLabel()}</kbd>
    </button>
  );
}
