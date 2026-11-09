// Grouping of saved conversations ("Today", "Yesterday", ...). Pure: tested in Node, copied into the mobile app.
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

export const GROUPS = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'];

export const groupLabel = (value, now = new Date()) => {
  const stamp = new Date(value || 0);
  if (Number.isNaN(stamp.getTime())) return 'Older';
  const age = Math.floor((startOfDay(now) - startOfDay(stamp)) / DAY);
  if (age <= 0) return 'Today';
  if (age === 1) return 'Yesterday';
  if (age <= 7) return 'Previous 7 days';
  if (age <= 30) return 'Previous 30 days';
  return 'Older';
};

export const stamp = (chat) => chat.updatedAt || chat.createdAt;

export const groupConversations = (chats, { query = '', now = new Date() } = {}) => {
  const needle = String(query).trim().toLowerCase();
  const visible = chats.filter((chat) => !needle || String(chat.title || '').toLowerCase().includes(needle));
  const sorted = [...visible].sort((a, b) => new Date(stamp(b) || 0) - new Date(stamp(a) || 0));
  return GROUPS.map((label) => ({ label, chats: sorted.filter((chat) => groupLabel(stamp(chat), now) === label) })).filter((group) => group.chats.length);
};

export const clockTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// What the chat endpoint receives as context: the last few real messages, never error placeholders.
export const historyForApi = (messages, limit = 8) =>
  messages.filter((message) => !message.error && message.content).slice(-limit).map(({ role, content }) => ({ role, content }));
