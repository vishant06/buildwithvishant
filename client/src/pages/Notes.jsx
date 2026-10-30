import { FileUp, FolderOpen, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DocumentCard, { CardSkeletons } from '../components/docs/DocumentCard.jsx';
import GuidesGrid from '../components/docs/GuidesGrid.jsx';
import Seo from '../components/Seo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { docsApi } from '../services/documentsApi.js';
import '../styles/notes-docs.css';

const useDebounced = (value, ms = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

export default function Notes() {
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'guides' ? 'guides' : 'pdf';
  const q = params.get('q') || '';
  const subject = params.get('subject') || '';
  const category = params.get('category') || '';
  const language = params.get('language') || '';
  const sort = params.get('sort') || '';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const filtering = Boolean(q || subject || category || language || sort || page > 1);

  const [text, setText] = useState(q);
  const debouncedText = useDebounced(text);
  const [facets, setFacets] = useState({ subjects: [], categories: [], languages: [] });
  const [home, setHome] = useState({ loading: true, recent: [], popular: [], subjects: [], error: '' });
  const [results, setResults] = useState({ loading: false, items: [], pages: 1, total: 0, error: '' });

  const update = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedText !== q) update({ q: debouncedText.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText]);

  useEffect(() => {
    docsApi.facets().then(setFacets).catch(() => undefined);
    docsApi.home().then((data) => setHome({ loading: false, ...data, error: '' })).catch((error) => setHome((h) => ({ ...h, loading: false, error: error.message })));
  }, []);

  useEffect(() => {
    if (tab !== 'pdf' || !filtering) return undefined;
    let cancelled = false;
    setResults((r) => ({ ...r, loading: true, error: '' }));
    docsApi
      .list({ q, subject, category, language, sort, page })
      .then((data) => !cancelled && setResults({ loading: false, items: data.items, pages: data.pages, total: data.total, error: '' }))
      .catch((error) => !cancelled && setResults({ loading: false, items: [], pages: 1, total: 0, error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [tab, filtering, q, subject, category, language, sort, page]);

  const uploadTarget = isAuthenticated ? '/notes/upload' : '/login';
  const hasAnything = home.recent.length > 0;

  return (
    <section className="nd-page-wrap">
      <Seo title="Notes library | BuildWithVishant" description="Read programming and computer-science notes online, or share your own PDF notes with the community." path="/notes" />
      <div className="nd-head">
        <div className="section-header" style={{ margin: 0 }}>
          <span>Learning library</span>
          <h1>Read notes. Share yours.</h1>
          <p>Community PDF notes you can read right here, plus guides written by Vishant.</p>
        </div>
        <div className="nd-actions">
          {isAuthenticated && <Link className="btn ghost" to="/notes/contributions"><FolderOpen size={16} /> My notes</Link>}
          <Link className="btn primary" to={uploadTarget} state={isAuthenticated ? undefined : { from: '/notes/upload' }}><FileUp size={16} /> Upload notes</Link>
        </div>
      </div>

      <div className="nd-tabs" role="tablist" aria-label="Notes type">
        <button type="button" role="tab" className="nd-tab" aria-selected={tab === 'pdf'} onClick={() => update({ tab: '' })}>PDF notes</button>
        <button type="button" role="tab" className="nd-tab" aria-selected={tab === 'guides'} onClick={() => update({ tab: 'guides' })}>Guides</button>
      </div>

      {tab === 'guides' ? (
        <GuidesGrid />
      ) : (
        <>
          <div className="nd-search panel" role="search">
            <label className="sr-only" htmlFor="nd-q">Search notes</label>
            <input id="nd-q" type="search" placeholder="Search title, subject, topic, tag or author…" value={text} onChange={(event) => setText(event.target.value)} />
            <select aria-label="Subject" value={subject} onChange={(event) => update({ subject: event.target.value })}>
              <option value="">All subjects</option>
              {facets.subjects.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
            </select>
            <select aria-label="Category" value={category} onChange={(event) => update({ category: event.target.value })}>
              <option value="">All categories</option>
              {facets.categories.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
            </select>
            <select aria-label="Sort" value={sort} onChange={(event) => update({ sort: event.target.value })}>
              <option value="">{q ? 'Best match' : 'Newest'}</option>
              {q && <option value="recent">Newest</option>}
              <option value="popular">Most read</option>
            </select>
          </div>

          {filtering ? (
            <>
              {results.loading ? <CardSkeletons count={8} /> : results.error ? (
                <p className="notice" role="alert">{results.error} <button type="button" className="btn ghost" onClick={() => update({}, { resetPage: false })}>Retry</button></p>
              ) : results.items.length ? (
                <>
                  <p className="nd-meta" aria-live="polite">{results.total} {results.total === 1 ? 'note' : 'notes'} found</p>
                  <div className="nd-grid">{results.items.map((doc) => <DocumentCard key={doc.slug} doc={doc} />)}</div>
                  {results.pages > 1 && (
                    <nav className="nd-pager" aria-label="Pagination">
                      <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, { resetPage: false })}>Previous</button>
                      <span>Page {page} of {results.pages}</span>
                      <button type="button" className="btn ghost" disabled={page >= results.pages} onClick={() => update({ page: String(page + 1) }, { resetPage: false })}>Next</button>
                    </nav>
                  )}
                </>
              ) : (
                <div className="nd-empty"><Search size={30} /><p>No notes match your search.</p><button type="button" className="btn ghost" onClick={() => { setText(''); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</button></div>
              )}
            </>
          ) : home.loading ? (
            <CardSkeletons count={8} />
          ) : home.error ? (
            <p className="notice" role="alert">{home.error}</p>
          ) : !hasAnything ? (
            <div className="nd-empty">
              <FileUp size={34} />
              <p>No community notes have been published yet. Be the first to share yours!</p>
              <Link className="btn primary" to={uploadTarget}>Upload notes</Link>
            </div>
          ) : (
            <>
              {home.subjects.length > 0 && (
                <div className="nd-section">
                  <header><h2>Browse by subject</h2></header>
                  <div className="nd-subjects">{home.subjects.map((item) => <button type="button" key={item.name} onClick={() => update({ subject: item.name })}>{item.name}<small>{item.count}</small></button>)}</div>
                </div>
              )}
              <div className="nd-section">
                <header><h2>Recently uploaded</h2><button type="button" className="btn ghost" onClick={() => update({ sort: 'recent', page: '1' }, { resetPage: false })}>See all</button></header>
                <div className="nd-grid">{home.recent.map((doc) => <DocumentCard key={doc.slug} doc={doc} />)}</div>
              </div>
              {home.popular.length > 0 && (
                <div className="nd-section">
                  <header><h2>Most read</h2><button type="button" className="btn ghost" onClick={() => update({ sort: 'popular' })}>See all</button></header>
                  <div className="nd-grid">{home.popular.map((doc) => <DocumentCard key={doc.slug} doc={doc} />)}</div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
