import { API_URL, SERVER_URL } from '../config/urls.js';
import { TOKEN_KEY } from '../auth/session.js';

// Thin fetch wrapper for the BuildWithVishant API. Sends the stored JWT as a
// Bearer token, exactly as before the app was split into three.
const request = async (path, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const absoluteAsset = (url) => {
  if (!url) return '';
  return url.startsWith('http') ? url : `${SERVER_URL}${url}`;
};

// Downloads a note's PDF. Uses fetch directly (not `request` above) because
// the response body is a binary PDF stream, not JSON. The backend is the
// source of truth on auth — a 401 here means "not logged in / session
// expired" regardless of what local auth state says.
export const downloadNotePdf = async (slug) => {
  const token = localStorage.getItem(TOKEN_KEY);

  let response;
  try {
    response = await fetch(`${API_URL}/notes/${slug}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (_networkError) {
    throw new Error('Network error — please check your connection and try again.');
  }

  if (response.status === 401) {
    const error = new Error('Login to download notes as PDF.');
    error.code = 'UNAUTHENTICATED';
    throw error;
  }
  if (response.status === 404) {
    throw new Error('This note could not be found.');
  }
  if (!response.ok) {
    let message = 'Could not generate the PDF. Please try again.';
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `${slug}-notes.pdf`;
  const blob = await response.blob();
  return { blob, filename };
};

export default request;
