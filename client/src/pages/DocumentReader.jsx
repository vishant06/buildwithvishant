import { Bookmark, BookmarkCheck, Check, Code2, Download, Flag, Link2, Lock, Sparkles, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appHref } from '@shared/auth/sso.js';
import { PLAYGROUND_URL } from '@shared/config/urls.js';
import AiPanel from '../components/docs/AiPanel.jsx';
import { Thumb } from '../components/docs/DocumentCard.jsx';
import PdfViewer from '../components/docs/PdfViewer.jsx';
import ReportModal from '../components/docs/ReportModal.jsx';
import Seo from '../components/Seo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authHeaders, docsApi, downloadDocument, fileUrl } from '../services/documentsApi.js';
import '../styles/notes-docs.css';

const fmt = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');

// The reader: the PDF gets the main column; related notes, the optional Playground action and the
// optional study assistant sit in a secondary sidebar (below the document on small screens).
export default function DocumentReader() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const viewer = useRef(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [related, setRelated] = useState({ items: [], guides: [] });
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [report, setReport] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError('');
    docsApi.get(slug)
      .then((data) => {
        if (cancelled) return;
        setDoc(data);
        setSaved(Boolean(data.bookmarked));
        if (!data.statusOnly) docsApi.related(slug).then((r) => !cancelled && setRelated(r)).catch(() => undefined);
      })
      .catch((e) => !cancelled && setError(e.status === 404 ? 'This note is private, was removed, or does not exist.' : e.message));
    return () => {
      cancelled = true;
    };
  }, [slug, isAuthenticated]);

  const headers = useMemo(() => authHeaders(), [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps
  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2600);
  };
  const onSelection = useCallback((value) => setSelection(value), []);
  const onCite = useCallback((n) => viewer.current?.goToPage(n), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
  };
  const toggleSave = async () => {
    try {
      if (saved) await docsApi.unbookmark(slug);
      else await docsApi.bookmark(slug);
      setSaved(!saved);
    } catch (e) {
      flash(e.message);
    }
  };
  const download = async () => {
    try {
      const { blob, filename } = await downloadDocument(slug);
      const href = URL.createObjectURL(blob);
      const anchor = Object.assign(document.createElement('a'), { href, download: filename });
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      flash(e.message);
    }
  };

  if (error) {
    return <section className="nd-page-wrap"><div className="nd-empty"><Lock size={32} /><p role="alert">{error}</p><Link className="btn primary" to="/notes">Back to notes</Link></div></section>;
  }
  if (!doc) return <section className="nd-page-wrap"><div className="nd-skeleton" style={{ minHeight: 480 }} aria-label="Loading note" /></section>;
  if (doc.statusOnly) {
    return (
      <section className="nd-page-wrap">
        <div className="nd-banner bad" role="status"><TriangleAlert size={20} /><div><strong>“{doc.title}” was removed by an administrator.</strong>{doc.removalReason && <p style={{ margin: '6px 0 0' }}>Reason: {doc.removalReason}</p>}</div></div>
        <Link className="btn ghost" style={{ marginTop: 14 }} to="/notes/contributions">Back to my notes</Link>
      </section>
    );
  }

  const owner = doc.myRole === 'owner' || doc.myRole === 'admin';
  // Readers who are not the owner or an admin are never sent `status` (they can only open published notes).
  const published = !doc.status || doc.status === 'approved';
  const playgroundHref = doc.hasCode ? appHref(PLAYGROUND_URL, `/?starter=${encodeURIComponent(doc.slug)}`) : '';
  const textAvailable = doc.hasText;

  return (
    <section className="nd-page-wrap nd-reader">
      <Seo title={`${doc.title} | BuildWithVishant Notes`} description={doc.description} path={`/notes/doc/${doc.slug}`} />
      <div className="nd-main">
        {doc.status && doc.status !== 'approved' && (
          <div className={`nd-banner ${doc.status === 'rejected' ? 'bad' : 'warn'}`} role="status">
            <TriangleAlert size={20} />
            <div>
              {doc.status === 'pending' && <><strong>Waiting for review.</strong> Only you{doc.myRole === 'admin' ? ' and administrators' : ' and administrators'} can see this note until it is approved.</>}
              {doc.status === 'rejected' && <><strong>This note was not approved.</strong>{doc.rejectionReason && <> Reason: {doc.rejectionReason}</>} <Link to="/notes/contributions">Edit and resubmit</Link></>}
            </div>
          </div>
        )}
        {doc.status === 'approved' && doc.visibility !== 'public' && owner && <div className="nd-banner" role="status"><Lock size={18} /><span>{doc.visibility === 'unlisted' ? 'Unlisted: only people with the link can read this.' : 'Private: only you and administrators can read this.'}</span></div>}

        <div className="nd-title">
          <h1>{doc.title}</h1>
          <div className="chips">
            <span className="nd-chip accent">{doc.subject}</span>
            <span className="nd-chip">{doc.category}</span>
            {doc.language && <span className="nd-chip">{doc.language}</span>}
            {doc.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
          <div className="nd-meta">
            <span>By {doc.uploader}</span>
            <span>{fmt(doc.approvedAt || doc.createdAt)}</span>
            <span>{doc.pages} pages</span>
            {[doc.university, doc.course, doc.semester, doc.subjectCode].filter(Boolean).map((item) => <span key={item}>{item}</span>)}
            <span>Community-contributed, not official material</span>
          </div>
        </div>

        <div className="nd-actions" role="group" aria-label="Note actions">
          <button type="button" className="btn ghost" onClick={copyLink}>{copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? 'Copied' : 'Copy link'}</button>
          {doc.canDownload && <button type="button" className="btn ghost" onClick={download}><Download size={16} /> Download</button>}
          {!isAuthenticated && doc.downloadable && <Link className="btn ghost" to="/login"><Download size={16} /> Log in to download</Link>}
          {isAuthenticated && published && <button type="button" className="btn ghost" aria-pressed={saved} onClick={toggleSave}>{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? 'Saved' : 'Save'}</button>}
          {isAuthenticated && !owner && published && <button type="button" className="btn ghost" onClick={() => setReport(true)}><Flag size={16} /> Report</button>}
          {doc.hasCode && <a className="btn ghost" href={playgroundHref}><Code2 size={16} /> Try in Playground</a>}
        </div>

        <PdfViewer ref={viewer} url={fileUrl(doc.slug)} headers={headers} title={doc.title} onPageChange={setPage} onSelection={onSelection} />

        <div className="nd-box"><h2>About this note</h2><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{doc.description}</p></div>
      </div>

      <aside className="nd-side" aria-label="Related and study tools">
        <div className="nd-box">
          <h2>Related notes</h2>
          {related.items.length ? (
            <ul className="nd-rel">
              {related.items.map((item) => (
                <li key={item.slug}>
                  <Link to={`/notes/doc/${item.slug}`}>
                    <Thumb doc={item} />
                    <span><strong>{item.title}</strong><br /><small>{item.subject} · {item.pages} pages</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="nd-ai-note">No related notes yet.</p>}
        </div>
        {related.guides.length > 0 && (
          <div className="nd-box">
            <h2>Guides on this topic</h2>
            <ul className="nd-rel">{related.guides.map((guide) => <li key={guide.slug}><Link to={`/notes/${guide.slug}`}><span><strong>{guide.title}</strong></span></Link></li>)}</ul>
          </div>
        )}
        <details className="nd-box" open={typeof window !== 'undefined' && window.innerWidth >= 1100}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}><Sparkles size={14} /> Study assistant</summary>
          <div style={{ marginTop: 10 }}>
            <AiPanel slug={doc.slug} hasCode={doc.hasCode} textAvailable={textAvailable} currentPage={page} selection={selection} isAuthenticated={isAuthenticated} onCite={onCite} />
          </div>
        </details>
      </aside>

      {report && <ReportModal slug={doc.slug} onClose={() => setReport(false)} />}
      {toast && <div className="notice" role="status" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 95 }}>{toast}</div>}
    </section>
  );
}
