import { Bot, Check, Maximize2, Minimize2, Pencil, Plus, Save, Send, Trash2, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CodeBlock from "../components/notes/CodeBlock.jsx";
import { normalizeLanguage } from "../components/notes/blockTypes.js";
import { renderInlineMarkdown as renderInline } from "../components/notes/inlineMarkdown.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import request, { absoluteAsset } from "../services/api.js";
import "../styles/notes-blocks.css";

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

  // Fullscreen state — kept independent of any other page-level toggle
  // (e.g. the Playground's Fit to Screen) so the two never interfere.
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);

  const end = useRef(null);

  useEffect(() => {
    if (end.current) {
      end.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
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

  // Exit fullscreen with Escape, and keep the toggle in sync if the user
  // navigates away or reloads mid-fullscreen.
  useEffect(() => {
    if (!isChatFullscreen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsChatFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("chat-fullscreen-lock");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("chat-fullscreen-lock");
    };
  }, [isChatFullscreen]);

  const clear = () => {
    setMessages([{ ...welcome, time: now() }]);
    setText("");
    setLoading(false);
    setConversationId(null);
  };

  // "Save Chat" — creates a new saved conversation on first save, then
  // updates the same record on every save after that (renaming keeps
  // working the same way once a conversation exists).
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
    try {
      const conversation = await request(`/ai/conversations/${id}`);
      setMessages(conversation.messages?.length ? conversation.messages : [welcome]);
      setConversationId(conversation._id);
      setText("");
    } catch (_error) {
      // Conversation was deleted, or belongs to another user — drop it
      // from the visible list rather than leaving a dead link around.
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

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || loading) return;

    const message = text.trim();
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
        // Auto-save: once a conversation has already been saved once, keep
        // it up to date after every successful exchange. Failed/errored
        // replies (the catch branch below) are never persisted here.
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

  const keyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <section className={`assistant-page${isChatFullscreen ? " chat-fullscreen" : ""}`}>
      <header className="assistant-heading">
        <div>
          <span className="eyebrow">AI learning companion</span>
          <h1>Ask. Understand. Build.</h1>
          <p>Developer-focused help, with your key safely kept on the server.</p>
        </div>

        <div className="assistant-controls">
          <button type="button" className="btn ghost" onClick={clear}>
            <Plus size={16} /> new
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={saveChat}
            disabled={saving || messages.every((message) => message.isWelcome)}
            title="Save this conversation"
          >
            <Save size={16} /> {saving ? "Saving..." : "save"}
          </button>
          <button
            type="button"
            className="tool-button"
            onClick={() => setIsChatFullscreen((value) => !value)}
            title={isChatFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isChatFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isChatFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      <div className="assistant-body">
        {isAuthenticated && (
          <aside className="saved-chats">
            <strong>Saved Chats</strong>
            {savedChats.length ? (
              savedChats.map((chat) => (
                <div key={chat._id} className={chat._id === conversationId ? "selected" : ""}>
                  {renamingId === chat._id ? (
                    <form
                      className="rename-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitRename(chat._id);
                      }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        aria-label="Conversation title"
                      />
                      <button type="submit" aria-label="Save title">
                        <Check size={13} />
                      </button>
                      <button type="button" aria-label="Cancel rename" onClick={() => setRenamingId(null)}>
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button className="chat-title" onClick={() => openConversation(chat._id)}>
                        {chat.title}
                      </button>
                      <button aria-label={`Rename ${chat.title}`} onClick={() => startRename(chat)}>
                        <Pencil size={13} />
                      </button>
                      {confirmDeleteId === chat._id ? (
                        <button
                          className="confirm-delete"
                          aria-label={`Confirm delete ${chat.title}`}
                          onClick={() => deleteChat(chat._id)}
                        >
                          <Check size={13} />
                        </button>
                      ) : (
                        <button aria-label={`Delete ${chat.title}`} onClick={() => setConfirmDeleteId(chat._id)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : (
              <small>No saved chats yet.</small>
            )}
          </aside>
        )}

        <div className="chat panel">
          <div className="chat-messages">
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

          {loading && (
            <article className="message assistant">
              <span className="message-avatar" aria-hidden="true">
                <Bot size={16} />
              </span>
              <div className="message-body">
                <div className="thinking">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </article>
          )}

          <div ref={end} />
        </div>

        <form onSubmit={send} className="chat-input">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={keyDown}
            placeholder="Write a message..."
            aria-label="Message AI assistant"
            disabled={loading}
          />
          <button type="submit" className="btn primary" disabled={loading || !text.trim()}>
            <Send size={16} /> {loading ? "Thinking..." : "Send"}
          </button>
        </form>
        </div>
      </div>
    </section>
  );
}
