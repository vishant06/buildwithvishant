import { useCallback, useEffect, useState } from 'react';
import PdfViewer from '../../components/docs/PdfViewer.jsx';
import { Thumb } from '../../components/docs/DocumentCard.jsx';
import { authHeaders, docsApi, fileUrl } from '../../services/documentsApi.js';
import '../../styles/notes-docs.css';

// Moderation of community PDF notes (the existing admin page hosts this panel). Every action is checked
// again by the server; this component only reflects what the API allows.
const TABS = [['pending', 'Pending'], ['reports', 'Reports'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['removed', 'Removed'], ['categories', 'Categories'], ['tags', 'Tags']];

function ReviewDialog({ doc, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const [mode, setMode] = useState('');
  const run = async (action) => {
    setState({ busy: true, error: '' });
    try {
      await docsApi.adminAct(doc.id, action, { reason });
      onDone();
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  };
  const needsReason = mode === 'reject' || mode === 'remove';
  return (
    <div className="nd-modal-back" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="nd-modal wide" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <h2 id="review-title">{doc.title}</h2>
        <p className="nd-meta"><span>{doc.uploaderUsername || doc.uploader}</span><span>{doc.uploaderEmail}</span><span>{doc.pages} pages</span><span>{doc.subject} · {doc.category}</span><span className="nd-chip">{doc.status}</span>{doc.openReports > 0 && <span className="nd-chip bad">{doc.openReports} open reports</span>}</p>
        <p style={{ margin: 0 }}>{doc.description}</p>
        <PdfViewer url={fileUrl(doc.slug)} headers={authHeaders()} title={doc.title} height={460} />
        {doc.audit?.length > 0 && <ul className="nd-audit">{doc.audit.map((entry, i) => <li key={i}>{new Date(entry.at).toLocaleString()} · {entry.byRole} · {entry.action}{entry.reason ? ` · ${entry.reason}` : ''}</li>)}</ul>}
        {needsReason && <label className="nd-form">Reason shown to the uploader<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label>}
        {state.error && <p className="nd-err" role="alert" style={{ color: 'var(--danger)' }}>{state.error}</p>}
        <div className="nd-modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          {needsReason ? (
            <>
              <button type="button" className="btn ghost" onClick={() => setMode('')}>Back</button>
              <button type="button" className="btn primary" disabled={state.busy || reason.trim().length < 3} onClick={() => run(mode)}>{mode === 'reject' ? 'Reject' : 'Remove'}</button>
            </>
          ) : (
            <>
              {doc.status === 'pending' && <button type="button" className="btn ghost" onClick={() => setMode('reject')}>Reject…</button>}
              {doc.status === 'approved' && <button type="button" className="btn ghost" disabled={state.busy} onClick={() => run('unpublish')}>Unpublish (back to review)</button>}
              {doc.status !== 'removed' && <button type="button" className="btn ghost" onClick={() => setMode('remove')}>Remove…</button>}
              {doc.status === 'removed' && <button type="button" className="btn ghost" disabled={state.busy} onClick={() => run('restore')}>Restore</button>}
              {(doc.status === 'pending' || doc.status === 'rejected') && <button type="button" className="btn primary" disabled={state.busy} onClick={() => run('approve')}>Approve and publish</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Simple({ load, render, empty }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    load().then((items) => setState({ loading: false, items, error: '' })).catch((error) => setState({ loading: false, items: [], error: error.message }));
  }, [load]);
  useEffect(refresh, [refresh]);
  if (state.loading) return <p className="notice">Loading…</p>;
  if (state.error) return <p className="notice" role="alert">{state.error}</p>;
  if (!state.items.length) return <p className="notice">{empty}</p>;
  return <>{render(state.items, refresh)}</>;
}

export default function DocumentModeration() {
  const [tab, setTab] = useState('pending');
  const [stats, setStats] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const bump = () => {
    setVersion((n) => n + 1);
    docsApi.adminStats().then(setStats).catch(() => undefined);
  };
  useEffect(() => { docsApi.adminStats().then(setStats).catch(() => undefined); }, []);

  const loadStatus = useCallback(() => docsApi.adminQueue(tab), [tab, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadReports = useCallback(() => docsApi.adminReports('open'), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadCategories = useCallback(() => docsApi.adminCategories(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadTags = useCallback(() => docsApi.adminTags(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const guard = async (work, ok) => {
    try {
      await work();
      setMessage(ok);
      bump();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <section className="panel nd-page-wrap">
      <h2>Community PDF notes</h2>
      <p>New uploads stay private until you approve them. {stats ? `${stats.pending} pending · ${stats.openReports} open reports` : ''}</p>
      <div className="nd-admin-tabs" role="tablist">
        {TABS.map(([id, text]) => <button type="button" key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{text}{id === 'pending' && stats ? ` (${stats.pending})` : id === 'reports' && stats ? ` (${stats.openReports})` : ''}</button>)}
      </div>
      {message && <p className="notice" role="status">{message}</p>}

      {['pending', 'approved', 'rejected', 'removed'].includes(tab) && (
        <Simple key={`${tab}${version}`} load={loadStatus} empty={`No ${tab} notes.`} render={(items) => (
          <div className="nd-list">
            {items.map((doc) => (
              <article className="nd-row" key={doc.id}>
                <Thumb doc={doc} />
                <div><h3>{doc.title}</h3><div className="chips"><span className="nd-chip accent">{doc.subject}</span><span className="nd-chip">{doc.pages} pages</span>{doc.openReports > 0 && <span className="nd-chip bad">{doc.openReports} reports</span>}</div><p>{doc.uploaderUsername || doc.uploader} · {new Date(doc.createdAt).toLocaleDateString()}</p></div>
                <div className="nd-actions"><button type="button" className="btn primary" onClick={() => setReviewing(doc)}>Review</button></div>
              </article>
            ))}
          </div>
        )} />
      )}

      {tab === 'reports' && (
        <Simple key={`r${version}`} load={loadReports} empty="No open reports." render={(items) => (
          <div className="nd-list">
            {items.map((report) => (
              <article className="nd-row" key={report.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div><h3>{report.document?.title || 'Deleted note'}</h3><div className="chips"><span className="nd-chip bad">{report.reason.replace('_', ' ')}</span><span className="nd-chip">{report.document?.status}</span></div>{report.details && <p>{report.details}</p>}</div>
                <div className="nd-actions">
                  {report.document && <a className="btn ghost" href={`/notes/doc/${report.document.slug}`} target="_blank" rel="noreferrer">Open</a>}
                  <button type="button" className="btn ghost" onClick={() => guard(() => docsApi.adminResolveReport(report.id, { action: 'dismiss' }), 'Report dismissed.')}>Dismiss</button>
                  <button type="button" className="btn primary" onClick={() => window.confirm('Remove this note and close its reports?') && guard(() => docsApi.adminResolveReport(report.id, { action: 'remove', note: 'Removed after a report' }), 'Note removed.')}>Remove note</button>
                </div>
              </article>
            ))}
          </div>
        )} />
      )}

      {tab === 'categories' && (
        <Simple key={`c${version}`} load={loadCategories} empty="No categories." render={(items) => (
          <>
            <form className="nd-form" onSubmit={(event) => { event.preventDefault(); const name = new FormData(event.currentTarget).get('name'); event.currentTarget.reset(); guard(() => docsApi.adminAddCategory(name), 'Category added.'); }} style={{ gridTemplateColumns: '1fr auto', marginBottom: 12 }}>
              <input name="name" placeholder="New category" maxLength={80} required aria-label="New category name" /><button type="submit" className="btn primary">Add</button>
            </form>
            <div className="nd-list">
              {items.map((category) => (
                <div className="nd-row" key={category.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <div><strong>{category.name}</strong> <span className="nd-chip">{category.documents} notes</span></div>
                  <div className="nd-actions">
                    <button type="button" className="btn ghost" onClick={() => { const name = window.prompt('Rename category', category.name); if (name && name !== category.name) guard(() => docsApi.adminRenameCategory(category.id, name), 'Category renamed.'); }}>Rename</button>
                    <button type="button" className="btn ghost" disabled={category.documents > 0} title={category.documents ? 'Still used by notes' : ''} onClick={() => guard(() => docsApi.adminDeleteCategory(category.id), 'Category deleted.')}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )} />
      )}

      {tab === 'tags' && (
        <Simple key={`t${version}`} load={loadTags} empty="No tags in use yet." render={(items) => (
          <div className="chips">
            {items.map((tag) => (
              <span key={tag.name} className="nd-chip" style={{ gap: 8 }}>
                #{tag.name} ({tag.count})
                <button type="button" className="btn ghost" style={{ minHeight: 24, padding: '0 8px' }} onClick={() => { const to = window.prompt(`Rename or merge "${tag.name}" into:`, tag.name); if (to && to.trim().toLowerCase() !== tag.name) guard(() => docsApi.adminRenameTag(tag.name, to), 'Tag updated.'); }}>Rename</button>
                <button type="button" className="btn ghost" style={{ minHeight: 24, padding: '0 8px' }} onClick={() => window.confirm(`Remove #${tag.name} from all notes?`) && guard(() => docsApi.adminDeleteTag(tag.name), 'Tag removed.')}>Remove</button>
              </span>
            ))}
          </div>
        )} />
      )}

      {reviewing && <ReviewDialog doc={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); setMessage('Done.'); bump(); }} />}
    </section>
  );
}
