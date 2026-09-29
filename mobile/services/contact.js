import request from "./api.js";

<<<<<<< HEAD
// Backend requires name, email, subject and message — matches
// server/src/controllers/contactController.js (400s without `subject`).
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
export const sendMessage = (payload) => request("/contact", { method: "POST", body: JSON.stringify(payload) });
