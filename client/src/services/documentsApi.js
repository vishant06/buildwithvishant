import { API_URL } from '@shared/config/urls.js';
import { TOKEN_KEY } from '@shared/auth/session.js';
import request from './api.js';

// Client for the community PDF notes API. The backend decides who may see what;
// nothing here is a security boundary.
const qs = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') query.set(key, String(value).trim());
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};
const json = (method, body) => ({ method, body: JSON.stringify(body || {}) });
const enc = encodeURIComponent;

export const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fileUrl = (slug) => `${API_URL}/documents/${enc(slug)}/file`;
export const thumbnailUrl = (slug) => `${API_URL}/documents/${enc(slug)}/thumbnail`;

export const docsApi = {
  config: () => request('/documents/config'),
  home: () => request('/documents/home'),
  list: (params) => request(`/documents${qs(params)}`),
  facets: () => request('/documents/facets'),
  categories: () => request('/documents/categories'),
  get: (slug) => request(`/documents/${enc(slug)}`),
  related: (slug) => request(`/documents/${enc(slug)}/related`),
  mine: () => request('/documents/mine'),
  bookmarks: () => request('/documents/bookmarks'),
  bookmark: (slug) => request(`/documents/${enc(slug)}/bookmark`, json('POST')),
  unbookmark: (slug) => request(`/documents/${enc(slug)}/bookmark`, json('DELETE')),
  report: (slug, body) => request(`/documents/${enc(slug)}/report`, json('POST', body)),
  update: (id, body) => request(`/documents/manage/${id}`, json('PATCH', body)),
  resubmit: (id) => request(`/documents/manage/${id}/resubmit`, json('POST')),
  remove: (id) => request(`/documents/manage/${id}`, { method: 'DELETE' }),
  codeExample: (slug) => request(`/documents/${enc(slug)}/code-example`),
  ask: (slug, body) => request(`/documents/${enc(slug)}/ai`, json('POST', body)),
  // admin
  adminStats: () => request('/documents/admin/stats'),
  adminQueue: (status) => request(`/documents/admin/documents${qs({ status })}`),
  adminAct: (id, action, body) => request(`/documents/admin/documents/${id}/${action}`, json('POST', body)),
  adminReports: (status) => request(`/documents/admin/reports${qs({ status })}`),
  adminResolveReport: (id, body) => request(`/documents/admin/reports/${id}/resolve`, json('POST', body)),
  adminCategories: () => request('/documents/admin/categories'),
  adminAddCategory: (name) => request('/documents/admin/categories', json('POST', { name })),
  adminRenameCategory: (id, name) => request(`/documents/admin/categories/${id}`, json('PATCH', { name })),
  adminDeleteCategory: (id) => request(`/documents/admin/categories/${id}`, { method: 'DELETE' }),
  adminTags: () => request('/documents/admin/tags'),
  adminRenameTag: (from, to) => request('/documents/admin/tags/rename', json('POST', { from, to })),
  adminDeleteTag: (tag) => request(`/documents/admin/tags/${enc(tag)}`, { method: 'DELETE' })
};

// multipart upload with a progress callback (fetch cannot report upload progress)
export const uploadForm = (path, formData, { method = 'POST', onProgress } = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_URL}${path}`);
    Object.entries(authHeaders()).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(Math.round((event.loaded / event.total) * 100));
    xhr.onerror = () => reject(Object.assign(new Error('Network error. Check your connection and try again.'), { retryable: true }));
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      const error = new Error(data.message || 'Upload failed. Please try again.');
      error.status = xhr.status;
      error.data = data;
      error.retryable = xhr.status >= 500 || xhr.status === 0;
      reject(error);
    };
    xhr.send(formData);
  });

// Binary download (like downloadNotePdf in shared/api/request.js, but for community PDFs).
export const downloadDocument = async (slug) => {
  const response = await fetch(`${API_URL}/documents/${enc(slug)}/download`, { headers: authHeaders() });
  if (response.status === 401) throw Object.assign(new Error('Log in to download notes.'), { code: 'UNAUTHENTICATED' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Could not download this note.');
  }
  return { blob: await response.blob(), filename: `${slug}.pdf` };
};

export const humanSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
