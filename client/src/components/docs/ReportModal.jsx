import { useState } from 'react';
import { docsApi } from '../../services/documentsApi.js';

const REASONS = [
  ['copyright', 'Copyright or I own this content'],
  ['inappropriate', 'Inappropriate or harmful content'],
  ['spam', 'Spam or advertising'],
  ['wrong_information', 'Wrong or misleading information'],
  ['other', 'Something else']
];

export default function ReportModal({ slug, onClose }) {
  const [reason, setReason] = useState('copyright');
  const [details, setDetails] = useState('');
  const [state, setState] = useState({ busy: false, message: '', error: '' });
  const send = async (event) => {
    event.preventDefault();
    setState({ busy: true, message: '', error: '' });
    try {
      const data = await docsApi.report(slug, { reason, details });
      setState({ busy: false, message: data.message, error: '' });
    } catch (error) {
      setState({ busy: false, message: '', error: error.message });
    }
  };
  return (
    <div className="nd-modal-back" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="nd-modal nd-form" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={send}>
        <h2 id="report-title">Report this note</h2>
        {state.message ? <p role="status">{state.message}</p> : (
          <>
            <label>Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)}>{REASONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select>
            </label>
            <label>Details <small>(optional)</small>
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} />
            </label>
            {state.error && <p className="nd-err" role="alert">{state.error}</p>}
          </>
        )}
        <div className="nd-modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>{state.message ? 'Close' : 'Cancel'}</button>
          {!state.message && <button type="submit" className="btn primary" disabled={state.busy}>Send report</button>}
        </div>
      </form>
    </div>
  );
}
