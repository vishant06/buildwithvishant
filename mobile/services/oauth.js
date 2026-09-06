import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api.js";

// The backend always redirects Google/GitHub sign-in back to this fixed
// custom-scheme URL when the flow is started with ?platform=mobile (see
// server/src/controllers/authController.js). This only resolves correctly
// in a dev-client or standalone/EAS build — Expo Go cannot own a custom
// `buildwithvishant://` scheme, so social login will not complete inside
// plain Expo Go. Email/password auth is unaffected either way.
const REDIRECT_URL = "buildwithvishant://auth/callback";

// ROOT CAUSE of "redirects back but never logs in": on Android,
// WebBrowser.openAuthSessionAsync frequently resolves with
// `{ type: 'dismiss' }` even when the OAuth flow completed successfully
// and the deep link fired correctly — this is a long-standing, documented
// Android limitation of Custom Tabs auth sessions, not something wrong in
// our own callback handling (see https://docs.expo.dev/versions/latest/sdk/webbrowser/
// — "add a handler with Linking.addEventListener before opening the
// browser... it will not automatically be dismissed when a deep link is
// handled"). The previous implementation trusted openAuthSessionAsync's
// result.type exclusively, so a false "dismiss" was indistinguishable from
// the user actually cancelling, and the app silently gave up and sat back
// on the login screen with no error.
//
// Fix: listen for the deep link directly via `Linking`, in parallel with
// openAuthSessionAsync. Whichever arrives first with a matching URL wins;
// openAuthSessionAsync's own result is now only a fallback for platforms
// (iOS) where it reliably reports success.
const parseCallbackUrl = (url) => {
  const fragment = url.split("#")[1] || "";
  const params = new URLSearchParams(fragment); // .get() already decodes — do not decodeURIComponent() again
  const error = params.get("error");
  if (error) throw new Error(error);

  const token = params.get("token");
  const userRaw = params.get("user");
  if (!token || !userRaw) throw new Error("Sign-in response was incomplete. Please try again.");

  return { token, user: JSON.parse(userRaw) };
};

export const signInWithProvider = (provider) =>
  new Promise((resolve, reject) => {
    const authUrl = `${API_URL}/auth/${provider}?platform=mobile`;
    let settled = false;

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      WebBrowser.dismissBrowser();
      fn();
    };

    // Authoritative path: the OS handed the redirect URL straight to the
    // app. This is what actually fires on Android even when
    // openAuthSessionAsync reports "dismiss".
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!url.startsWith(REDIRECT_URL)) return;
      finish(() => {
        try {
          resolve(parseCallbackUrl(url));
        } catch (err) {
          reject(err);
        }
      });
    });

    WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL)
      .then((result) => {
        if (settled) return;
        if (result.type === "success" && result.url) {
          finish(() => {
            try {
              resolve(parseCallbackUrl(result.url));
            } catch (err) {
              reject(err);
            }
          });
          return;
        }
        // "dismiss"/"cancel" here is ambiguous on Android (see note above)
        // — give the Linking listener a brief grace window in case the
        // deep link is still in flight before treating this as a real
        // user cancellation.
        setTimeout(() => finish(() => resolve(null)), 800);
      })
      .catch((err) => finish(() => reject(err)));
  });
