import request from "./api.js";

// Backend requires name, email, subject and message — matches
// server/src/controllers/contactController.js (400s without `subject`).
export const sendMessage = (payload) => request("/contact", { method: "POST", body: JSON.stringify(payload) });
