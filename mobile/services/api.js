import * as SecureStore from "expo-secure-store";

// Same backend the website talks to — never a second/duplicate API.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://portfolio-3h2m.onrender.com/api";
export const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

const TOKEN_KEY = "bwv_token";
const TIMEOUT_MS = 15000;

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

// AuthContext registers itself here so a 401 from anywhere in the app can
// clear the session immediately, without this module importing React/the
// auth context (which would create a circular import).
let onUnauthorized = null;
export const registerUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

const FRIENDLY_STATUS_MESSAGES = {
  400: "That request wasn't valid — check the details and try again.",
  403: "You don't have permission to do that.",
  404: "That couldn't be found.",
  409: "That already exists.",
  429: "You're doing that too often — please wait a moment and try again.",
  500: "Something went wrong on the server. Please try again shortly.",
  502: "The server is temporarily unavailable. Please try again shortly.",
  503: "This feature isn't available right now. Please try again shortly.",
};

// Central request helper — every service module goes through this one
// function, so auth headers, error shape, timeouts, and the base URL only
// live in one place.
const request = async (path, options = {}) => {
  const token = await tokenStore.get();
  const isFormData = options.body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: controller.signal,
    });
  } catch (networkError) {
    const error = new Error(
      networkError.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Unable to reach the server. Check your connection and try again."
    );
    error.isNetworkError = true;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      await tokenStore.clear();
      onUnauthorized?.();
    }
    const error = new Error(data.message || FRIENDLY_STATUS_MESSAGES[response.status] || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
};

// Absolute URL for images/files the API returns as relative paths
// (uploaded avatars, etc.) — Cloudinary URLs are already absolute and
// pass through unchanged.
export const absoluteAsset = (url) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `${SERVER_URL}${url}`;
};

export default request;
