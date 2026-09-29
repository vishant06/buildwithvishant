import request from "./api.js";

export const stats = () => request("/admin/stats");
export const listUsers = () => request("/admin/users");
export const updateUserRole = (id, role) =>
  request(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
export const updateUser = (id, payload) =>
  request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteUser = (id) => request(`/admin/users/${id}`, { method: "DELETE" });

export const listMessages = () => request("/contact/messages");
