import request from "./api.js";

export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

// Signup requires a profile photo on this backend (same rule the website
// enforces) — `avatar` is an object from expo-image-picker: { uri, name, type }.
export const signup = ({ name, username, email, password, avatar }) => {
  const form = new FormData();
  form.append("name", name);
  form.append("username", username);
  form.append("email", email);
  form.append("password", password);
  form.append("avatar", {
    uri: avatar.uri,
    name: avatar.fileName || "avatar.jpg",
    type: avatar.mimeType || "image/jpeg",
  });
  return request("/auth/signup", { method: "POST", body: form });
};

export const me = () => request("/auth/me");

export const resendVerification = () =>
  request("/auth/resend-verification", { method: "POST" });
