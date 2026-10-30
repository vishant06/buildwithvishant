import { Bot, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { docsApi } from '../../services/documentsApi.js';

// Optional study assistant. It only ever sends a question and a page number or a short selected
// passage: the server looks up the relevant text itself, after checking you may read this note.
const CITATION_SPLIT = /(\[p\.?\s*\d+(?:\s*[,-]\s*\d+)*\])/i; // split() with a capture group keeps the matches
const CITATION_ONE = /^\[p\.?\s*(\d+)(?:\s*[,-]\s*\d+)*\]$/i;

function Reply({ text, onCite }) {
  return (
    <div className="nd-ai-reply" aria-live="polite">
      {text.split(CITATION_SPLIT).map((part, index) => {
        const match = CITATION_ONE.exec(part);
        return match ? <button type="button" key={index} className="nd-cite" onClick={() => onCite(Number(match[1]))}>{part.replace(/[[\]]/g, '')}</button> : <span key={index}>{part}</span>;
      })}
    </div>
  );
}

export default function AiPanel({ slug, hasCode, textAvailable = true, currentPage, selection, isAuthenticated, onCite }) {
  const [question, setQuestion] = useState('');
  const [state, setState] = useState({ loading: false, reply: '', error: '', remaining: null });

  const run = async (body) => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await docsApi.ask(slug, body);
      setState({ loading: false, reply: data.reply, error: '', remaining: data.remaining });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
    }
  };

  if (!isAuthenticated) {
    return <p className="nd-ai-note"><Link to="/login">Log in</Link> to use the study assistant on this note.</p>;
  }
  if (!textAvailable && !hasCode) {
    return <p className="nd-ai-note">This PDF has no selectable text (it may be scanned), so the assistant cannot read it.</p>;
  }
  const disabled = state.loading;
  return (
    <div>
      <div className="nd-ai-actions" role="group" aria-label="Quick actions">
        {textAvailable && <button type="button" disabled={disabled} onClick={() => run({ action: 'summarize' })}>Summarize</button>}
        {textAvailable && <button type="button" disabled={disabled} onClick={() => run({ action: 'practice' })}>Practice questions</button>}
        {textAvailable && <button type="button" disabled={disabled} onClick={() => run({ action: 'explain_page', page: currentPage })}>Explain page {currentPage}</button>}
        {textAvailable && selection && <button type="button" disabled={disabled} onClick={() => run({ action: 'explain_page', page: selection.page, selection: selection.text })} title={selection.text}>Explain selection</button>}
        {hasCode && <button type="button" disabled={disabled} onClick={() => run({ action: 'explain_code' })}>Explain code</button>}
      </div>
      {textAvailable && (
        <form className="nd-ai-form" onSubmit={(event) => { event.preventDefault(); if (question.trim().length >= 3) run({ action: 'ask', question }); }}>
          <label className="sr-only" htmlFor="nd-ai-q">Ask about this note</label>
          <input id="nd-ai-q" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this note…" maxLength={1000} disabled={disabled} />
          <button type="submit" className="btn primary" disabled={disabled || question.trim().length < 3} aria-label="Ask">{disabled ? <Loader2 size={16} className="nd-spin" /> : <Sparkles size={16} />}</button>
        </form>
      )}
      {state.loading && <p className="nd-ai-note" role="status"><Bot size={14} /> Reading the relevant pages…</p>}
      {state.error && <p className="nd-ai-note" role="alert" style={{ color: 'var(--danger)' }}>{state.error}</p>}
      {state.reply && <Reply text={state.reply} onCite={onCite} />}
      <p className="nd-ai-note">AI can make mistakes. Page links point only to pages the assistant was given.{state.remaining !== null ? ` ${state.remaining} requests left today.` : ''}</p>
    </div>
  );
}
