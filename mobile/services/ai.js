import request from "./api.js";

export const chat = (message, history) =>
  request("/ai/chat", { method: "POST", body: JSON.stringify({ message, history }) });

export const listConversations = () => request("/ai/conversations");
export const getConversation = (id) => request(`/ai/conversations/${id}`);
export const saveConversation = (messages, title) =>
  request("/ai/conversations", { method: "POST", body: JSON.stringify({ messages, title }) });
export const updateConversation = (id, payload) =>
  request(`/ai/conversations/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteConversation = (id) => request(`/ai/conversations/${id}`, { method: "DELETE" });
