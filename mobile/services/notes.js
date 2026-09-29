<<<<<<< HEAD
import { File, Paths } from "expo-file-system";
import request, { API_URL, tokenStore } from "./api.js";
=======
import request from "./api.js";
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764

// Public
export const listNotes = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return request(`/notes${query ? `?${query}` : ""}`);
};

export const getNote = (slug) => request(`/notes/${slug}`);

<<<<<<< HEAD
// Mirrors web's downloadNotePdf (client/src/services/api.js) status/error
// handling exactly — same 401/404/generic-message logic — but adapted for
// React Native: no Blob/<a download>, so the bytes are written to a real
// file via expo-file-system and handed back as a local file:// uri that
// DownloadPdfButton then shares/saves via expo-sharing. Bypasses the
// shared `request()` JSON helper since this response is binary.
export const downloadNotePdf = async (slug) => {
  const token = await tokenStore.get();

  let response;
  try {
    response = await fetch(`${API_URL}/notes/${slug}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (_networkError) {
    throw new Error("Network error — please check your connection and try again.");
  }

  if (response.status === 401) {
    const error = new Error("Login to download notes as PDF.");
    error.code = "UNAUTHENTICATED";
    throw error;
  }
  if (response.status === 404) {
    throw new Error("This note could not be found.");
  }
  if (!response.ok) {
    let message = "Could not generate the PDF. Please try again.";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `${slug}-notes.pdf`;

  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(bytes);

  return { uri: file.uri, filename };
};

=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
// Admin
export const listAdminNotes = () => request("/notes/admin/all");
export const getAdminNote = (id) => request(`/notes/admin/${id}`);

export const createNote = (payload) =>
  request("/notes", { method: "POST", body: JSON.stringify(payload) });

export const updateNote = (id, payload) =>
  request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export const deleteNote = (id) => request(`/notes/${id}`, { method: "DELETE" });

// Uploads the picked image straight to Cloudinary via the existing backend
// route and returns the resulting URL — the admin never has to paste one.
export const uploadThumbnail = (image) => {
  const form = new FormData();
  form.append("thumbnail", {
    uri: image.uri,
    name: image.fileName || "thumbnail.jpg",
    type: image.mimeType || "image/jpeg",
  });
  return request("/notes/admin/thumbnail", { method: "POST", body: form });
};
