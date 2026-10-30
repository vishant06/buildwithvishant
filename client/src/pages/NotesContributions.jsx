import { BookOpen, FileUp, Loader2, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DocumentCard, { CardSkeletons, Thumb } from '../components/docs/DocumentCard.jsx';
import DocumentFields, { valuesFromDocument } from '../components/docs/DocumentFields.jsx';
import { previewPdf } from '../components/docs/pdfPreview.js';
import { docsApi, uploadForm } from '../services/documentsApi.js';
import '../styles/notes-docs.css';

const STATUS = {
  pending: { chip: 'warn', label: 'Pending review', note: 'Private: only you and administrators can see it until it is approved.' },
  approved: { chip: 'ok', label: 'Approved', note: '' },
  rejected: { chip: 'bad', label: 'Not approved', note: 'Edit the details or replace the file, then resubmit.' },
  removed: { chip: 'bad', label: 'Removed', note: 'An administrator removed this note.' }
};
const availability = (doc) => {
  if (doc.status !== 'approved') return '';
  return { public: 'Publicly available and searchable.', unlisted: 'Unlisted: anyone with the link can read it; it is not listed.', private: 'Private: only you and administrators can read it.' }[doc.visibility] || '';
};

function EditDialog({ doc, config, onClose, onSaved }) {
  const [values, setValues] = useState(() => valuesFromDocument(doc));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: '' });
  useEffect(() => {
    if (doc.hasCode) docsApi.codeExample(doc.slug).then((c) => setValues((v) => ({ ...v, code: c.code, codeLanguage: c.language, codeTitle: c.title }))).catch(() => undefined);
  }, [doc.slug, doc.hasCode]);
  const save = async (event) => {
    event.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const body = { ...values, downloadable: values.downloadable !== false };
      const updated = await docsApi.update(doc.id, body);
      onSaved(updated);
    } catch (error) {
      setErrors(error.data?.errors || {});
      setState({ busy: false, error: error.message });
    }
  };
  return (
    <div className="nd-modal-back" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="nd-modal wide nd-form" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={save} style={{ maxWidth: 'none' }}>
        <h2 id="edit-title">Edit details</h2>
        <DocumentFields values={values} errors={errors} config={config} disabled={state.busy} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
        {state.error && <p className="nd-err" role="alert">{state.error}</p>}
        <div className="nd-modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={state.busy}>Save changes</button>
        </div>
      </form>
    </div>
  );
}

export default function NotesContributions() {
  const [tab, setTab] = useState('mine');
  const [mine, setMine] = useState({ loading: true, items: [], error: '' });
  const [saved, setSaved] = useState({ loading: false, items: [], error: '' });
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const replaceTarget = useRef(null);
  const fileInput = useRef(null);

  const load = useCallback(() => {
    setMine((m) => ({ ...m, loading: true, error: '' }));
    docsApi.mine().then((items) => setMine({ loading: false, items, error: '' })).catch((error) => setMine({ loading: false, items: [], error: error.message }));
  }, []);
  useEffect(() => {
    load();
    docsApi.config().then(setConfig).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    if (tab !== 'saved') return;
    setSaved((s) => ({ ...s, loading: true }));
    docsApi.bookmarks().then((items) => setSaved({ loading: false, items, error: '' })).catch((error) => setSaved({ loading: false, items: [], error: error.message }));
  }, [tab]);

  const act = async (doc, work, success) => {
    setBusyId(doc.id);
    setMessage('');
    try {
      await work();
      setMessage(success);
      load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  };
  const remove = (doc) => window.confirm(`Delete “${doc.title}”? It will disappear immediately.`) && act(doc, () => docsApi.remove(doc.id), 'Note deleted.');
  const replace = async (event) => {
    const file = event.target.files?.[0];
    const doc = replaceTarget.current;
    event.target.value = '';
    if (!file || !doc) return;
    await act(doc, async () => {
      const form = new FormData();
      form.append('pdf', file);
      try {
        const preview = await previewPdf(file);
        if (preview.thumbnail) form.append('thumbnail', preview.thumbnail, 'thumbnail.jpg');
      } catch {
        // the server validates the file anyway; a missing thumbnail is fine
      }
      await uploadForm(`/documents/manage/${doc.id}/file`, form);
    }, 'File replaced. The note goes back to review.');
  };

  return (
    <section className="nd-page-wrap">
      <div className="nd-head">
        <div className="section-header" style={{ margin: 0 }}><span>Contributions</span><h1>My notes</h1><p>Track what you shared and what you saved.</p></div>
        <Link className="btn primary" to="/notes/upload"><FileUp size={16} /> Upload notes</Link>
      </div>
      <div className="nd-tabs" role="tablist">
        <button type="button" role="tab" className="nd-tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>My uploads</button>
        <button type="button" role="tab" className="nd-tab" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}>Saved</button>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
      <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={replace} />

      {tab === 'saved' ? (
        saved.loading ? <CardSkeletons count={4} /> : saved.error ? <p className="notice" role="alert">{saved.error}</p> : saved.items.length ? <div className="nd-grid">{saved.items.map((doc) => <DocumentCard key={doc.slug} doc={doc} />)}</div> : <div className="nd-empty"><BookOpen size={30} /><p>Notes you save will appear here.</p><Link className="btn ghost" to="/notes">Browse notes</Link></div>
      ) : mine.loading ? <CardSkeletons count={3} /> : mine.error ? (
        <p className="notice" role="alert">{mine.error} <button type="button" className="btn ghost" onClick={load}><RefreshCw size={14} /> Retry</button></p>
      ) : mine.items.length === 0 ? (
        <div className="nd-empty"><FileUp size={30} /><p>You have not uploaded any notes yet.</p><Link className="btn primary" to="/notes/upload">Upload your first note</Link></div>
      ) : (
        <div className="nd-list">
          {mine.items.map((doc) => {
            const info = STATUS[doc.status] || STATUS.pending;
            const busy = busyId === doc.id;
            return (
              <article className="nd-row" key={doc.id || doc.slug}>
                {doc.statusOnly ? <div className="nd-thumb" /> : <Thumb doc={doc} />}
                <div>
                  <h3>{doc.statusOnly ? doc.title : <Link to={`/notes/doc/${doc.slug}`}>{doc.title}</Link>}</h3>
                  <div className="chips">
                    <span className={`nd-chip ${info.chip}`}>{info.label}</span>
                    {doc.subject && <span className="nd-chip">{doc.subject}</span>}
                    {doc.pages ? <span className="nd-chip">{doc.pages} pages</span> : null}
                  </div>
                  <p>{availability(doc) || info.note}</p>
                  {doc.status === 'rejected' && doc.rejectionReason && <div className="nd-reason"><strong>Reviewer feedback:</strong> {doc.rejectionReason}</div>}
                  {doc.status === 'removed' && doc.removalReason && <div className="nd-reason"><strong>Reason:</strong> {doc.removalReason}</div>}
                </div>
                {!doc.statusOnly && (
                  <div className="nd-actions">
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => setEditing(doc)}><Pencil size={15} /> Edit</button>
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => { replaceTarget.current = doc; fileInput.current?.click(); }}><RotateCcw size={15} /> Replace PDF</button>
                    {doc.status === 'rejected' && <button type="button" className="btn primary" disabled={busy} onClick={() => act(doc, () => docsApi.resubmit(doc.id), 'Resubmitted for review.')}>Resubmit</button>}
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => remove(doc)} aria-label={`Delete ${doc.title}`}>{busy ? <Loader2 size={15} className="nd-spin" /> : <Trash2 size={15} />}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {editing && <EditDialog doc={editing} config={config} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage('Details saved.'); load(); }} />}
    </section>
  );
}
