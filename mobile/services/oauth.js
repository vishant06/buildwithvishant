import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api.js";

export const REDIRECT_URL = "buildwithvishant://auth/callback";

// buildwithvishant://auth/callback#token=...&user=...
// token/user live in the URL FRAGMENT, not the query string, so
// useLocalSearchParams (query-only) can never see them — the raw URL has to
// be read directly and the fragment parsed by hand. Exported so the single
// root-level listener in app/_layout.jsx can reuse it (see that file for why
// the parsing/session logic lives there and not in a screen component).
export const parseCallbackUrl = (url) => {
  const hashIndex = url.indexOf("#");
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const params = new URLSearchParams(fragment);

  const error = params.get("error");
  if (error) throw new Error(error);

  const token = params.get("token");
  const userRaw = params.get("user");

  if (!token || !userRaw) {
    throw new Error("Sign-in response was incomplete. Please try again.");
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Invalid sign-in response. Please try again.");
  }

  return { token, user };
};

// Opens Google/GitHub OAuth in a Custom Tab and waits only for the browser
// to close. It deliberately does NOT try to read the deep-link result
// itself — the redirect is captured by the persistent listener in
// app/_layout.jsx, which exists for the whole app session and isn't subject
// to the mount-timing race a screen-local or call-scoped listener runs
// into. A closed browser is never treated as a successful sign-in.
export const signInWithProvider = async (provider) => {
  const authUrl = `${API_URL}/auth/${provider}?platform=mobile`;

  console.log("[OAUTH] AUTH URL:", authUrl);
  console.log("[OAUTH] REDIRECT:", REDIRECT_URL);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL);
  console.log("[OAUTH] BROWSER RESULT:", result?.type);
};
