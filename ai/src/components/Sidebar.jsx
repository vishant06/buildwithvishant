import { Check, MoreHorizontal, PanelLeftClose, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { groupConversations } from '../lib/history.js';

// Conversation history: new chat, search, day groups, rename and delete (with confirmation).
export default function Sidebar({ open, chats, loading, currentId, isAuthenticated, loginHref, onNew, onOpen, onRename, onDelete, onClose }) {
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirm, setConfirm] = useState(null);
  const menuRef = useRef(null);
  const groups = useMemo(() => groupConversations(chats, { query }), [chats, query]);

  useEffect(() => {
    if (!menuId) return undefined;
    const close = (event) => !menuRef.current?.contains(event.target) && setMenuId(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuId]);

  const submitRename = (id) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (title) onRename(id, title);
  };

  return (
    <aside className={`ai-sidebar${open ? ' open' : ''}`} aria-label="Conversations" aria-hidden={!open}>
      <div className="ai-sidebar-head">
        <button type="button" className="ai-new" onClick={onNew}><Plus size={16} /> New chat</button>
        <button type="button" className="ai-icon" onClick={onClose} aria-label="Hide conversations"><PanelLeftClose size={18} /></button>
      </div>

      {isAuthenticated && chats.length > 0 && (
        <label className="ai-search">
          <Search size={14} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" aria-label="Search conversations" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button>}
        </label>
      )}

      <nav className="ai-chats" aria-label="Saved conversations">
        {!isAuthenticated && <p className="ai-side-note"><a href={loginHref}>Log in</a> to chat and keep your conversations.</p>}
        {isAuthenticated && loading && <p className="ai-side-note" role="status">Loading chats…</p>}
        {isAuthenticated && !loading && chats.length === 0 && <p className="ai-side-note">Your conversations are saved here automatically.</p>}
        {isAuthenticated && !loading && chats.length > 0 && groups.length === 0 && <p className="ai-side-note">No chats match “{query}”.</p>}
        {groups.map((group) => (
          <section key={group.label} className="ai-group">
            <h2>{group.label}</h2>
            {group.chats.map((chat) => (
              <div key={chat._id} className={`ai-chat${chat._id === currentId ? ' selected' : ''}`}>
                {renamingId === chat._id ? (
                  <form className="ai-rename" onSubmit={(event) => { event.preventDefault(); submitRename(chat._id); }}>
                    <input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setRenamingId(null)} aria-label="Conversation title" maxLength={80} />
                    <button type="submit" aria-label="Save title"><Check size={14} /></button>
                    <button type="button" aria-label="Cancel rename" onClick={() => setRenamingId(null)}><X size={14} /></button>
                  </form>
                ) : (
                  <>
                    <button type="button" className="ai-chat-title" onClick={() => onOpen(chat._id)} title={chat.title} aria-current={chat._id === currentId ? 'true' : undefined}>{chat.title}</button>
                    <div className="ai-menu-wrap" ref={menuId === chat._id ? menuRef : null}>
                      <button type="button" className="ai-chat-act" aria-label={`Options for ${chat.title}`} aria-haspopup="menu" aria-expanded={menuId === chat._id} onClick={() => setMenuId(menuId === chat._id ? null : chat._id)}><MoreHorizontal size={15} /></button>
                      {menuId === chat._id && (
                        <div className="ai-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setMenuId(null); setRenamingId(chat._id); setRenameValue(chat.title); }}><Pencil size={14} /> Rename</button>
                          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuId(null); setConfirm(chat); }}><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </section>
        ))}
      </nav>

      {confirm && (
        <div className="ai-dialog-back" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirm(null)}>
          <div className="ai-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ai-del-title" aria-describedby="ai-del-text">
            <h2 id="ai-del-title">Delete chat?</h2>
            <p id="ai-del-text">“{confirm.title}” will be permanently deleted. This cannot be undone.</p>
            <div className="ai-dialog-actions">
              <button type="button" className="ai-btn" onClick={() => setConfirm(null)} autoFocus>Cancel</button>
              <button type="button" className="ai-btn danger" onClick={() => { onDelete(confirm._id); setConfirm(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
