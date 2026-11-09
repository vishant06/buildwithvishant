import { ArrowDown, Check, Copy, Maximize2, Menu, Minimize2, PanelLeftOpen, RefreshCw, SquarePen, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import request from '@shared/api/request.js';
import { useAuth } from '@shared/auth/AuthContext.jsx';
import { MAIN_SITE_URL } from '@shared/config/urls.js';
import '@client/styles/notes-blocks.css';
import Composer from '../components/Composer.jsx';
import Markdown from '../components/Markdown.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { clockTime, historyForApi } from '../lib/history.js';
import './ai.css';

const SUGGESTIONS = [
  { title: 'Explain a concept', text: 'Explain closures in JavaScript with a simple example' },
  { title: 'Compare', text: 'What is the difference between SQL INNER JOIN and LEFT JOIN?' },
  { title: 'Debug', text: 'Help me understand a Java NullPointerException and how to fix it' },
  { title: 'Learn', text: 'Explain Big-O notation simply, with common examples' },
];

const now = () => new Date().toISOString();
const isDesktop = () => window.matchMedia('(min-width: 861px)').matches;

function MessageActions({ message, isLast, loading, onCopy, onRegenerate, onRetry }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await onCopy(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <div className="msg-actions">
      {message.error ? (
        <button type="button" onClick={onRetry} disabled={loading}><RefreshCw size={14} /> Try again</button>
      ) : (
        <>
          <button type="button" onClick={copy} aria-label="Copy response">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          {isLast && <button type="button" onClick={onRegenerate} disabled={loading} aria-label="Regenerate response"><RefreshCw size={14} /> Regenerate</button>}
        </>
      )}
    </div>
  );
}

export default function Assistant() {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | failed
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const [fullscreen, setFullscreen] = useState(false);
  const [nearBottom, setNearBottom] = useState(true);
  const scroller = useRef(null);
  const composer = useRef(null);
  const stick = useRef(true);
  const idRef = useRef(null); // latest conversation id for async callbacks
  idRef.current = conversationId;

  const loginHref = `${MAIN_SITE_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;
  const firstName = (user?.name || '').split(' ')[0];
  const current = chats.find((chat) => chat._id === conversationId);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (!isAuthenticated) {
      setChats([]);
      return;
    }
    setChatsLoading(true);
    request('/ai/conversations').then(setChats).catch(() => setChats([])).finally(() => setChatsLoading(false));
  }, [isAuthenticated]);

  // follow new messages only while the reader is at the bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);
  useEffect(() => {
    if (stick.current) scrollToBottom();
  }, [messages, loading, scrollToBottom]);
  const onScroll = () => {
    const el = scroller.current;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stick.current = near;
    setNearBottom(near);
  };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && !isDesktop() && setSidebarOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      // not available: the app already fills the window
    }
  };
  const closeOnPhone = () => !isDesktop() && setSidebarOpen(false);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  // every successful exchange is saved automatically (a new conversation on the first reply)
  const persist = async (all) => {
    if (!isAuthenticated) return;
    const toSave = all.filter((message) => !message.error).map(({ role, content, time }) => ({ role, content, time }));
    if (!toSave.length) return;
    setSaveState('saving');
    try {
      const id = idRef.current;
      const saved = id
        ? await request(`/ai/conversations/${id}`, { method: 'PUT', body: JSON.stringify({ messages: toSave }) })
        : await request('/ai/conversations', { method: 'POST', body: JSON.stringify({ messages: toSave }) });
      if (!id) setConversationId(saved._id);
      setChats((items) => [saved, ...items.filter((item) => item._id !== saved._id)]);
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  };

  const ask = async (question, base) => {
    const history = historyForApi(base);
    const withQuestion = [...base, { role: 'user', content: question, time: now() }];
    setMessages(withQuestion);
    stick.current = true;
    setLoading(true);
    try {
      const data = await request('/ai/chat', { method: 'POST', body: JSON.stringify({ message: question, history }) });
      const reply = { role: 'assistant', content: data?.reply || 'I could not generate a response. Please try again.', time: now(), error: !data?.reply };
      const next = [...withQuestion, reply];
      setMessages(next);
      if (!reply.error) persist(next);
    } catch (error) {
      setMessages([...withQuestion, { role: 'assistant', content: error?.message || 'Something went wrong. Please try again.', time: now(), error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const send = (raw = text) => {
    const question = raw.trim();
    if (!question || loading || !isAuthenticated) return;
    setText('');
    ask(question, messages.filter((message) => !message.error));
  };
  const retryOrRegenerate = () => {
    // drop the failed / old answer, then ask the same question again with the context that preceded it
    const trimmed = [...messages];
    while (trimmed.length && trimmed[trimmed.length - 1].role !== 'user') trimmed.pop();
    const last = trimmed.pop();
    if (last) ask(last.content, trimmed.filter((message) => !message.error));
  };

  const startNew = () => {
    setMessages([]);
    setText('');
    setLoading(false);
    setConversationId(null);
    setSaveState('idle');
    stick.current = true;
    closeOnPhone();
    setTimeout(() => composer.current?.focus(), 0);
  };
  const openChat = async (id) => {
    closeOnPhone();
    try {
      const conversation = await request(`/ai/conversations/${id}`);
      setMessages(conversation.messages || []);
      setConversationId(conversation._id);
      setSaveState('saved');
      stick.current = true;
    } catch {
      setChats((items) => items.filter((item) => item._id !== id));
      if (conversationId === id) startNew();
    }
  };
  const renameChat = async (id, title) => {
    try {
      const updated = await request(`/ai/conversations/${id}`, { method: 'PUT', body: JSON.stringify({ title }) });
      setChats((items) => items.map((item) => (item._id === id ? updated : item)));
    } catch {
      // the old title stays; the user can try again
    }
  };
  const deleteChat = async (id) => {
    try {
      await request(`/ai/conversations/${id}`, { method: 'DELETE' });
      setChats((items) => items.filter((item) => item._id !== id));
      if (conversationId === id) startNew();
    } catch {
      // still listed; the user can try again
    }
  };

  const lastAssistant = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].role === 'assistant') return i;
    return -1;
  })();

  const composerEl = (
    <Composer
      ref={composer}
      value={text}
      onChange={setText}
      onSend={() => send()}
      loading={loading}
      disabled={!isAuthenticated}
      placeholder={isAuthenticated ? 'Ask anything about code, concepts or debugging…' : 'Log in to start chatting'}
      hint={isAuthenticated ? 'Enter to send · Shift+Enter for a new line · AI can make mistakes, check important code.' : ''}
    />
  );

  return (
    <div className="ai-app">
      {sidebarOpen && <button type="button" className="ai-scrim" aria-label="Close conversations" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        open={sidebarOpen}
        chats={chats}
        loading={chatsLoading}
        currentId={conversationId}
        isAuthenticated={isAuthenticated}
        loginHref={loginHref}
        onNew={startNew}
        onOpen={openChat}
        onRename={renameChat}
        onDelete={deleteChat}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="ai-main" aria-label="Chat">
        <header className="ai-toolbar">
          <div className="ai-toolbar-left">
            {!sidebarOpen && <button type="button" className="ai-icon" onClick={() => setSidebarOpen(true)} aria-label="Show conversations">{isDesktop() ? <PanelLeftOpen size={18} /> : <Menu size={18} />}</button>}
            <h1 className="ai-title">{current?.title || 'New chat'}</h1>
            {isAuthenticated && !isEmpty && <span className={`ai-save ${saveState}`} role="status">{{ saving: 'Saving…', saved: 'Saved', failed: 'Not saved' }[saveState] || ''}</span>}
          </div>
          <div className="ai-toolbar-right">
            {!sidebarOpen && <button type="button" className="ai-icon" onClick={startNew} aria-label="New chat"><SquarePen size={17} /></button>}
            <button type="button" className="ai-icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>{fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>
        </header>

        <div className="ai-scroll" ref={scroller} onScroll={onScroll}>
          {isEmpty ? (
            <div className="ai-hero">
              <div className="ai-hero-mark" aria-hidden="true">BWV</div>
              <h2>{firstName ? `Hi ${firstName}, what are we building?` : 'What are we building today?'}</h2>
              <p>Ask about code, concepts or bugs. I explain step by step and show working examples.</p>
              {composerEl}
              {isAuthenticated ? (
                <div className="ai-suggestions" role="list">
                  {SUGGESTIONS.map((item) => (
                    <button type="button" role="listitem" key={item.title} onClick={() => send(item.text)}>
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <a className="ai-login" href={loginHref}>Log in to chat</a>
              )}
            </div>
          ) : (
            <div className="ai-thread" role="log" aria-live="polite" aria-label="Conversation">
              {messages.map((message, index) => (
                <article key={index} className={`msg ${message.role}${message.error ? ' error' : ''}`}>
                  {message.role === 'user' ? (
                    <div className="msg-user"><p>{message.content}</p></div>
                  ) : (
                    <div className="msg-assistant">
                      <span className="msg-avatar" aria-hidden="true">BWV</span>
                      <div className="msg-content">
                        {message.error && <p className="msg-error"><TriangleAlert size={15} /> {message.content}</p>}
                        {!message.error && <Markdown text={message.content} />}
                        <div className="msg-foot">
                          <time dateTime={message.time} title={new Date(message.time).toLocaleString()}>{clockTime(message.time)}</time>
                          <MessageActions message={message} isLast={index === lastAssistant && index === messages.length - 1} loading={loading} onCopy={copyText} onRegenerate={retryOrRegenerate} onRetry={retryOrRegenerate} />
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {loading && (
                <article className="msg assistant" aria-live="polite">
                  <div className="msg-assistant">
                    <span className="msg-avatar" aria-hidden="true">BWV</span>
                    <div className="thinking" role="status" aria-label="The assistant is thinking"><i /><i /><i /></div>
                  </div>
                </article>
              )}
            </div>
          )}
        </div>

        {!nearBottom && !isEmpty && <button type="button" className="ai-jump" onClick={() => { stick.current = true; scrollToBottom(); }} aria-label="Scroll to latest message"><ArrowDown size={16} /></button>}
        {!isEmpty && composerEl}
      </section>
    </div>
  );
}
