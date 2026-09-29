import { ChevronRight, Menu, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DownloadPdfButton from '../components/DownloadPdfButton.jsx';
import NoteRail from '../components/notes/NoteRail.jsx';
import NoteRenderer from '../components/notes/NoteRenderer.jsx';
import NoteSidebar from '../components/notes/NoteSidebar.jsx';
import { categoryKey, getPrevNext, getRailNotes, groupNotesByCategory } from '../components/notes/noteNavigation.js';
import useNotesIndex from '../hooks/useNotesIndex.js';
import useReadingProgress from '../hooks/useReadingProgress.js';
import { loadNote, peekNote } from '../services/notesCache.js';
import '../styles/notes-blocks.css';
import '../styles/notes-reader.css';

export default function NoteDetail() {
  const { slug } = useParams();
  const { notes, loading: indexLoading, error: indexError } = useNotesIndex();
  const [note, setNote] = useState(() => peekNote(slug));
  const [status, setStatus] = useState(() => (peekNote(slug) ? 'ready' : 'loading')); // loading | ready | error
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const articleRef = useRef(null);
  const toggleRef = useRef(null);

  // Fetch the note for the current slug. Sidebars stay mounted and keep their
  // state while only this part changes; notes read in the last minute come
  // straight from the cache.
  useEffect(() => {
    let active = true;
    const cached = peekNote(slug);
    if (cached) {
      setNote(cached);
      setStatus('ready');
    } else {
      setStatus('loading');
    }
    loadNote(slug)
      .then((data) => {
        if (!active) return;
        setNote(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'This note could not be found.');
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [slug]);

  // A new note starts at the top, with the mobile topics drawer closed.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawerOpen(false);
  }, [slug]);

  // Drawer (below 1100px): Escape closes it and page scroll is locked behind it.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        toggleRef.current?.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  // A note fetched for a previous slug must never render under a new URL.
  const current = note && note.slug === slug ? note : null;
  const isLoading = status === 'loading' || (status === 'ready' && !current);
  const isError = status === 'error';

  // Per-page SEO. Restores the site defaults set in index.html on unmount so
  // navigating to another page doesn't carry a stale title/description.
  useEffect(() => {
    if (!current) return undefined;
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute('content');
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonicalTag?.getAttribute('href');

    document.title = `${current.title} | BuildWithVishant Notes`;
    if (descriptionTag) descriptionTag.setAttribute('content', current.description);
    if (canonicalTag) canonicalTag.setAttribute('href', `${window.location.origin}/notes/${current.slug}`);

    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription !== undefined) descriptionTag.setAttribute('content', previousDescription);
      if (canonicalTag && previousCanonical !== undefined) canonicalTag.setAttribute('href', previousCanonical);
    };
  }, [current]);

  const groups = useMemo(() => groupNotesByCategory(notes), [notes]);
  // The list entry is available before the full note arrives, so the topic is
  // highlighted and the rail is populated immediately on direct URL loads.
  const listEntry = useMemo(() => notes.find((item) => item.slug === slug) || null, [notes, slug]);
  const subject = current || listEntry;
  const { prev, next } = useMemo(() => getPrevNext(groups, slug), [groups, slug]);
  const { related, others } = useMemo(() => getRailNotes(notes, subject), [notes, subject]);
  const progress = useReadingProgress(articleRef, current?.slug);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="notes-shell">
      <button
        type="button"
        className={`notes-backdrop${drawerOpen ? ' is-open' : ''}`}
        onClick={closeDrawer}
        tabIndex={-1}
        aria-hidden="true"
      />

      <aside id="notes-topics" className={`notes-topics${drawerOpen ? ' is-open' : ''}`} aria-label="Topics">
        <button type="button" className="notes-drawer-close" onClick={closeDrawer} aria-label="Close topics">
          <X size={18} />
        </button>
        <NoteSidebar
          groups={groups}
          activeSlug={slug}
          activeKey={subject ? categoryKey(subject) : null}
          loading={indexLoading}
          error={indexError}
          onNavigate={closeDrawer}
        />
      </aside>

      <div className="notes-main">
        <div className="notes-topbar">
          <div className="notes-topbar-row">
            <button
              type="button"
              ref={toggleRef}
              className="notes-topics-toggle"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="notes-topics"
            >
              <Menu size={16} aria-hidden="true" /> Topics
            </button>
            <nav className="notes-breadcrumb" aria-label="Breadcrumb">
              <Link to="/notes">Notes</Link>
              {subject && (
                <>
                  <ChevronRight size={13} aria-hidden="true" />
                  <span>{subject.category}</span>
                  <ChevronRight size={13} aria-hidden="true" />
                  <span className="notes-breadcrumb-current" aria-current="page">
                    {subject.title}
                  </span>
                </>
              )}
            </nav>
            {current && <span className="notes-progress-label">{progress}%</span>}
          </div>
          <div
            className="notes-progress"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
        </div>

        {isError ? (
          <div className="panel empty-state">
            <p className="notice error">{error}</p>
            <Link className="btn primary" to="/notes">
              Back to Notes
            </Link>
          </div>
        ) : isLoading ? (
          <article className="notes-article notes-article-loading" aria-busy="true">
            <p className="notice">Loading note...</p>
          </article>
        ) : (
          <article className="notes-article" ref={articleRef}>
            <header className="notes-article-header">
              <span className="eyebrow">
                {current.category} · {current.difficulty}
              </span>
              <h1>{current.title}</h1>
              <p className="lead">{current.description}</p>
              <div className="note-card-meta">
                {current.author?.name && <span>{current.author.name}</span>}
                {current.createdAt && <span>{new Date(current.createdAt).toLocaleDateString()}</span>}
              </div>
              {current.tags?.length > 0 && (
                <div className="chips">
                  {current.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              )}
              <div className="note-reader-actions">
                <DownloadPdfButton slug={current.slug} />
              </div>
            </header>

            <div className="note-reader-body">
              <NoteRenderer note={current} />
            </div>
          </article>
        )}
      </div>

      <aside className="notes-rail" aria-label="More notes">
        <NoteRail prev={prev} next={next} related={related} others={others} loading={indexLoading} />
      </aside>
    </div>
  );
}
