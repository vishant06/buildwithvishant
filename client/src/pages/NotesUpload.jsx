import { CheckCircle2, FileUp, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DocumentFields, { emptyValues } from '../components/docs/DocumentFields.jsx';
import { previewPdf } from '../components/docs/pdfPreview.js';
import { useAuth } from '../context/AuthContext.jsx';
import { docsApi, humanSize, uploadForm } from '../services/documentsApi.js';
import '../styles/notes-docs.css';

// Upload a PDF note. Everything is validated again on the server; the checks here only save you a wasted upload.
export default function NotesUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState({ pages: 0, thumbnail: null, thumbnailUrl: '', error: '' });
  const [rights, setRights] = useState(false);
  const [state, setState] = useState({ phase: 'idle', progress: 0, message: '', retryable: false });
  const [done, setDone] = useState(null);
  const inFlight = useRef(false); // a double click can never send two uploads

  useEffect(() => {
    docsApi.config().then(setConfig).catch(() => setConfig({ categories: [], codeLanguages: [], maxFileMb: 15, maxPages: 400, maxCodeChars: 20000 }));
  }, []);
  useEffect(() => () => preview.thumbnailUrl && URL.revokeObjectURL(preview.thumbnailUrl), [preview.thumbnailUrl]);

  const choose = async (picked) => {
    setErrors((e) => ({ ...e, pdf: '' }));
    setPreview({ pages: 0, thumbnail: null, thumbnailUrl: '', error: '' });
    if (!picked) return setFile(null);
    if (!/\.pdf$/i.test(picked.name) || (picked.type && picked.type !== 'application/pdf')) {
      setFile(null);
      return setErrors((e) => ({ ...e, pdf: 'Only PDF files are accepted.' }));
    }
    if (config && picked.size > config.maxFileMb * 1024 * 1024) {
      setFile(null);
      return setErrors((e) => ({ ...e, pdf: `That file is ${humanSize(picked.size)}. The limit is ${config.maxFileMb} MB.` }));
    }
    setFile(picked);
    try {
      const info = await previewPdf(picked);
      if (config && info.pages > config.maxPages) {
        setFile(null);
        return setErrors((e) => ({ ...e, pdf: `That PDF has ${info.pages} pages. The limit is ${config.maxPages}.` }));
      }
      setPreview({ ...info, error: '' });
      setValues((v) => (v.title ? v : { ...v, title: picked.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 140) }));
    } catch {
      setPreview((p) => ({ ...p, error: 'We could not preview this file here. You can still try to upload it.' }));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const problems = {};
    if (!file) problems.pdf = 'Choose a PDF file.';
    if (!rights) problems.rightsConfirmed = 'Please confirm you have the right to share this document.';
    ['title', 'description', 'subject', 'category'].forEach((key) => !String(values[key] || '').trim() && (problems[key] = 'Required.'));
    setErrors(problems);
    if (Object.keys(problems).length) return;

    inFlight.current = true;
    setState({ phase: 'uploading', progress: 0, message: '', retryable: false });
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => form.append(key, typeof value === 'boolean' ? String(value) : value));
    form.append('rightsConfirmed', 'true');
    form.append('pdf', file);
    if (preview.thumbnail) form.append('thumbnail', preview.thumbnail, 'thumbnail.jpg');
    try {
      const doc = await uploadForm('/documents', form, { onProgress: (progress) => setState((s) => ({ ...s, progress })) });
      setDone(doc);
      setState({ phase: 'done', progress: 100, message: '', retryable: false });
    } catch (error) {
      if (error.data?.errors) setErrors(error.data.errors);
      setState({ phase: 'error', progress: 0, message: error.message, retryable: Boolean(error.retryable), duplicateSlug: error.data?.slug });
    } finally {
      inFlight.current = false;
    }
  };

  if (done) {
    const pending = done.status === 'pending';
    return (
      <section className="nd-page-wrap" style={{ maxWidth: 640 }}>
        <div className="nd-banner" role="status">
          <CheckCircle2 size={22} />
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>{pending ? 'Submitted for review' : 'Published'}</h1>
            <p style={{ margin: 0 }}>{pending ? 'Your note is private until an administrator approves it. You can follow its status, edit details or delete it from My notes.' : 'Your note is live.'}</p>
          </div>
        </div>
        <div className="nd-actions" style={{ marginTop: 16 }}>
          <Link className="btn primary" to="/notes/contributions">My notes</Link>
          <Link className="btn ghost" to={`/notes/doc/${done.slug}`}>Open note</Link>
          <button type="button" className="btn ghost" onClick={() => { setDone(null); setFile(null); setValues(emptyValues); setRights(false); setPreview({ pages: 0, thumbnail: null, thumbnailUrl: '', error: '' }); setState({ phase: 'idle', progress: 0, message: '' }); }}>Upload another</button>
        </div>
      </section>
    );
  }

  const unverified = config?.requireVerifiedEmail && user && !user.isEmailVerified && user.role !== 'admin';
  const busy = state.phase === 'uploading';
  return (
    <section className="nd-page-wrap">
      <div className="section-header">
        <span>Share your notes</span>
        <h1>Upload a PDF</h1>
        <p>New notes are reviewed by an administrator before anyone else can see them.</p>
      </div>
      {unverified && <div className="nd-banner warn" role="alert"><TriangleAlert size={20} /><span>Please verify your email address first (check your inbox or your profile page). Uploads are only enabled for verified accounts.</span></div>}
      <form className="nd-form" onSubmit={submit} noValidate style={{ marginTop: 16 }}>
        <div className={`nd-drop${file ? ' has-file' : ''}`}>
          <FileUp size={28} />
          {file ? (
            <>
              <strong>{file.name}</strong>
              <span>{humanSize(file.size)}{preview.pages ? ` · ${preview.pages} pages` : ''}</span>
              {preview.thumbnailUrl && <img src={preview.thumbnailUrl} alt="First page preview" style={{ width: 120, borderRadius: 6, border: '1px solid var(--border)' }} />}
            </>
          ) : <span>PDF only · up to {config?.maxFileMb || 15} MB · up to {config?.maxPages || 400} pages</span>}
          <input type="file" accept="application/pdf,.pdf" onChange={(event) => choose(event.target.files?.[0])} disabled={busy} aria-label="PDF file" aria-invalid={Boolean(errors.pdf)} />
          {errors.pdf && <span className="nd-err" role="alert">{errors.pdf}</span>}
          {preview.error && <span className="nd-err">{preview.error}</span>}
        </div>

        <DocumentFields values={values} errors={errors} config={config} disabled={busy} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />

        <label className="check">
          <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} disabled={busy} />
          <span>I created these notes or have permission to share them, and I understand they will be shown with my name. {errors.rightsConfirmed && <span className="nd-err" role="alert">{errors.rightsConfirmed}</span>}</span>
        </label>

        {busy && (
          <div role="status" aria-live="polite">
            <div className="nd-progress"><div style={{ width: `${state.progress}%` }} /></div>
            <small>{state.progress < 100 ? `Uploading… ${state.progress}%` : 'Checking your PDF…'}</small>
          </div>
        )}
        {state.phase === 'error' && (
          <div className="nd-banner bad" role="alert">
            <TriangleAlert size={20} />
            <div>
              <p style={{ margin: 0 }}>{state.message}</p>
              {state.duplicateSlug && <p style={{ margin: '6px 0 0' }}><Link to={`/notes/doc/${state.duplicateSlug}`}>Open the existing note</Link></p>}
            </div>
          </div>
        )}
        <div className="nd-actions">
          <button type="submit" className="btn primary" disabled={busy || unverified}>
            {busy ? <><Loader2 size={16} className="nd-spin" /> Uploading</> : state.phase === 'error' && state.retryable ? 'Retry upload' : 'Submit for review'}
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate('/notes')} disabled={busy}>Cancel</button>
        </div>
      </form>
    </section>
  );
}
