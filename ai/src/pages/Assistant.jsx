import {
  Bot,
  Check,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import request, { absoluteAsset } from "@shared/api/request.js";
import { useAuth } from "@shared/auth/AuthContext.jsx";
import { MAIN_SITE_URL } from "@shared/config/urls.js";
// The note code blocks (syntax highlighting, copy, run) are reused as-is so AI
// answers look identical to the notes on the main site.
import CodeBlock from "@client/components/notes/CodeBlock.jsx";
import { normalizeLanguage } from "@client/components/notes/blockTypes.js";
import { renderInlineMarkdown as renderInline } from "@client/components/notes/inlineMarkdown.jsx";
import "@client/styles/notes-blocks.css";
import "./ai.css";

const now = () => new Date().toISOString();

const welcome = {
  role: "assistant",
  content:
    "Hi — I’m your developer learning assistant. Ask me...",
  time: now(),
  isWelcome: true,
};

// Turns a plain-text segment into paragraphs / bullet lists / numbered
// lists / light headings, applying inline formatting along the way.
const renderTextSegment = (text, segmentKey) => {
  const lines = text.split("\n");
  const nodes = [];
  let listBuffer = [];
  let listType = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    nodes.push(
      <Tag key={`${segmentKey}-list-${nodes.length}`} className="message-list">
        {listBuffer.map((item, index) => (
          <li key={index}>{renderInline(item, `${segmentKey}-li-${nodes.length}-${index}`)}</li>
        ))}
      </Tag>
    );
    listBuffer = [];
    listType = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)/);

    if (bulletMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(bulletMatch[1]);
      return;
    }

    if (numberedMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(numberedMatch[1]);
      return;
    }

    flushList();

    if (headingMatch) {
      nodes.push(
        <p key={`${segmentKey}-h-${index}`} className="message-heading">
          {renderInline(headingMatch[1], `${segmentKey}-h-${index}`)}
        </p>
      );
      return;
    }

    nodes.push(<p key={`${segmentKey}-p-${index}`}>{renderInline(trimmed, `${segmentKey}-p-${index}`)}</p>);
  });

  flushList();
  return nodes;
};

const renderMessage = (content) => {
  if (!content) return null;

  return content
    .split(/(```[\s\S]*?```)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("```")) {
        const fenceMatch = part.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
        const language = normalizeLanguage(fenceMatch?.[1]);
        const code = (fenceMatch?.[2] ?? part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")).replace(/\n$/, "");
        return <CodeBlock key={index} language={language} content={code} />;
      }
      return (
        <div className="message-text" key={index}>
          {renderTextSegment(part, `seg-${index}`)}
        </div>
      );
    });
};

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const SUGGESTIONS = [
  "Explain closures in JavaScript with an example",
  "What is the difference between SQL joins?",
  "Help me debug a Java NullPointerException",
  "Explain Big-O notation simply",
];

export default function Assistant() {
  const { isAuthenticated, user } = useAuth();

  const [messages, setMessages] = useState([welcome]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // Saved-conversations state.
  const [savedChats, setSavedChats] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // The sidebar is open by default on desktop and a slide-over on phones.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 861px)").matches);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const end = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const loadSavedChats = () => {
    if (!isAuthenticated) return;
    request("/ai/conversations")
      .then(setSavedChats)
      .catch(() => {});
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedChats([]);
      return;
    }
    loadSavedChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Grow the message box with its content (up to a cap set in CSS).
  useEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [text]);

  const closeSidebarOnPhone = () => {
    if (!window.matchMedia("(min-width: 861px)").matches) setSidebarOpen(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen unavailable — the app already fills the viewport.
    }
  };

  const clear = () => {
    setMessages([{ ...welcome, time: now() }]);
    setText("");
    setLoading(false);
    setConversationId(null);
    closeSidebarOnPhone();
    inputRef.current?.focus();
  };

  // "Save" — creates a new saved conversation on first save, then updates the
  // same record on every save after that.
  const saveChat = async () => {
    if (!isAuthenticated) {
      setMessages((items) => [
        ...items,
        { role: "assistant", content: "Please login to save conversations.", time: now() },
      ]);
      return;
    }

    const toSave = messages.filter((message) => !message.isWelcome);
    if (!toSave.length) return;

    setSaving(true);
    try {
      if (conversationId) {
        const updated = await request(`/ai/conversations/${conversationId}`, {
          method: "PUT",
          body: JSON.stringify({ messages: toSave }),
        });
        setSavedChats((items) => [updated, ...items.filter((item) => item._id !== updated._id)]);
      } else {
        const created = await request("/ai/conversations", {
          method: "POST",
          body: JSON.stringify({ messages: toSave }),
        });
        setConversationId(created._id);
        setSavedChats((items) => [created, ...items]);
      }
    } catch (error) {
      setMessages((items) => [
        ...items,
        { role: "assistant", content: "Sorry, " + (error?.message || "couldn't save this chat."), time: now() },
      ]);
    } finally {
      setSaving(false);
    }
  };

  const openConversation = async (id) => {
    closeSidebarOnPhone();
    try {
      const conversation = await request(`/ai/conversations/${id}`);
      setMessages(conversation.messages?.length ? conversation.messages : [welcome]);
      setConversationId(conversation._id);
      setText("");
    } catch (_error) {
      // Conversation was deleted, or belongs to another user — drop it from
      // the visible list rather than leaving a dead link around.
      setSavedChats((items) => items.filter((item) => item._id !== id));
      if (conversationId === id) clear();
    }
  };

  const startRename = (chat) => {
    setRenamingId(chat._id);
    setRenameValue(chat.title);
  };

  const submitRename = async (id) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      const updated = await request(`/ai/conversations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title }),
      });
      setSavedChats((items) => items.map((item) => (item._id === id ? updated : item)));
    } catch (_error) {
      // Leave the list as-is; the user can retry the rename.
    }
  };

  const deleteChat = async (id) => {
    try {
      await request(`/ai/conversations/${id}`, { method: "DELETE" });
      setSavedChats((items) => items.filter((item) => item._id !== id));
      if (conversationId === id) clear();
    } catch (_error) {
      // Leave the list as-is; the user can retry the delete.
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const sendMessage = async (raw) => {
    const message = raw.trim();
    if (!message || loading) return;
    setText("");

    setMessages((items) => [...items, { role: "user", content: message, time: now() }]);

    if (!isAuthenticated) {
      setMessages((items) => [
        ...items,
        { role: "assistant", content: "Please login to use the connected AI assistant.", time: now() },
      ]);
      return;
    }

    setLoading(true);

    try {
      const data = await request("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, history: messages.slice(-8) }),
      });

      const reply = { role: "assistant", content: data?.reply || "I couldn't generate a response. Please try again.", time: now() };
      setMessages((items) => {
        const next = [...items, reply];
        // Auto-save: once a conversation has been saved once, keep it up to
        // date after every successful exchange. Failed replies (the catch
        // branch below) are never persisted.
        if (conversationId) {
          const toSave = next.filter((item) => !item.isWelcome);
          request(`/ai/conversations/${conversationId}`, {
            method: "PUT",
            body: JSON.stringify({ messages: toSave }),
          })
            .then((updated) => {
              setSavedChats((chats) => [updated, ...chats.filter((chat) => chat._id !== updated._id)]);
            })
            .catch(() => {});
        }
        return next;
      });
    } catch (error) {
      setMessages((items) => [
        ...items,
        { role: "assistant", content: "Sorry, " + (error?.message || "something went wrong. Please try again."), time: now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = (event) => {
    event.preventDefault();
    sendMessage(text);
  };

  const keyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const onlyWelcome = messages.every((message) => message.isWelcome);
  const loginHref = `${MAIN_SITE_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="ai-app">
      {sidebarOpen && <button type="button" className="ai-scrim" aria-label="Close conversations" onClick={() => setSidebarOpen(false)} />}

      <aside className={`ai-sidebar${sidebarOpen ? " open" : ""}`} aria-label="Conversations">
        <div className="ai-sidebar-head">
          <button type="button" className="ai-new" onClick={clear}>
            <Plus size={16} /> New chat
          </button>
          <button type="button" className="ai-icon" onClick={() => setSidebarOpen(false)} aria-label="Hide conversations">
            <PanelLeftClose size={17} />
          </button>
        </div>

        <p className="ai-side-title">Saved chats</p>
        <div className="ai-chats">
          {!isAuthenticated && (
            <p className="ai-side-note">
              <a href={loginHref}>Log in</a> to chat with the assistant and keep your conversations.
            </p>
          )}
          {isAuthenticated && savedChats.length === 0 && <p className="ai-side-note">No saved chats yet. Press Save in a conversation to keep it.</p>}
          {savedChats.map((chat) => (
            <div key={chat._id} className={`ai-chat${chat._id === conversationId ? " selected" : ""}`}>
              {renamingId === chat._id ? (
                <form
                  className="ai-rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitRename(chat._id);
                  }}
                >
                  <input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} aria-label="Conversation title" />
                  <button type="submit" aria-label="Save title"><Check size={14} /></button>
                  <button type="button" aria-label="Cancel rename" onClick={() => setRenamingId(null)}><X size={14} /></button>
                </form>
              ) : (
                <>
                  <button type="button" className="ai-chat-title" onClick={() => openConversation(chat._id)} title={chat.title}>
                    {chat.title}
                  </button>
                  <button type="button" className="ai-chat-act" aria-label={`Rename ${chat.title}`} onClick={() => startRename(chat)}>
                    <Pencil size={13} />
                  </button>
                  {confirmDeleteId === chat._id ? (
                    <button type="button" className="ai-chat-act confirm" aria-label={`Confirm delete ${chat.title}`} onClick={() => deleteChat(chat._id)}>
                      <Check size={13} />
                    </button>
                  ) : (
                    <button type="button" className="ai-chat-act" aria-label={`Delete ${chat.title}`} onClick={() => setConfirmDeleteId(chat._id)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="ai-main">
        <header className="ai-toolbar">
          <div className="ai-toolbar-left">
            {!sidebarOpen && (
              <button type="button" className="ai-icon" onClick={() => setSidebarOpen(true)} aria-label="Show conversations">
                <PanelLeftOpen size={17} />
              </button>
            )}
            <strong>AI Assistant</strong>
            <span className="ai-tagline">Ask. Understand. Build.</span>
          </div>
          <div className="ai-toolbar-right">
            <button type="button" className="ai-btn" onClick={saveChat} disabled={saving || onlyWelcome} title="Save this conversation">
              <Save size={15} /> <span>{saving ? "Saving..." : "Save"}</span>
            </button>
            <button type="button" className="ai-icon" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </header>

        <div className="ai-scroll">
          <div className="ai-thread">
            {messages.map((message, index) => {
              const hasCode = message.content?.includes("```");
              return (
                <article className={`message ${message.role}${hasCode ? " has-code" : ""}`} key={index}>
                  <span className="message-avatar" aria-hidden="true">
                    {message.role === "assistant" ? (
                      <Bot size={16} />
                    ) : user?.avatar?.url ? (
                      <img src={absoluteAsset(user.avatar.url)} alt="" />
                    ) : (
                      <User size={16} />
                    )}
                  </span>
                  <div className="message-body">
                    {renderMessage(message.content)}
                    {message.time && <span className="message-time">{formatTime(message.time)}</span>}
                  </div>
                </article>
              );
            })}

            {onlyWelcome && !loading && isAuthenticated && (
              <div className="ai-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => sendMessage(suggestion)}>{suggestion}</button>
                ))}
              </div>
            )}

            {loading && (
              <article className="message assistant">
                <span className="message-avatar" aria-hidden="true"><Bot size={16} /></span>
                <div className="message-body">
                  <div className="thinking" role="status" aria-label="Assistant is thinking"><i /><i /><i /></div>
                </div>
              </article>
            )}
            <div ref={end} />
          </div>
        </div>

        <form onSubmit={send} className="ai-composer">
          <div className="ai-composer-box">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={keyDown}
              placeholder="Message the AI assistant…  (Shift+Enter for a new line)"
              aria-label="Message AI assistant"
              disabled={loading}
            />
            <button type="submit" className="ai-send" disabled={loading || !text.trim()} aria-label="Send message">
              <Send size={16} />
              <span>{loading ? "Thinking..." : "Send"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
