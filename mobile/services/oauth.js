<<<<<<< HEAD
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
=======
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api.js";

const REDIRECT_URL = "buildwithvishant://auth/callback";
const CALLBACK_TIMEOUT = 15000;

const parseCallbackUrl = (url) => {
  console.log("[OAUTH] CALLBACK:", url);

  const hashIndex = url.indexOf("#");
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";

  const params = new URLSearchParams(fragment);

  const error = params.get("error");

  if (error) {
    throw new Error(error);
  }
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764

  const token = params.get("token");
  const userRaw = params.get("user");

<<<<<<< HEAD
=======
  console.log("[OAUTH] TOKEN:", Boolean(token));
  console.log("[OAUTH] USER:", Boolean(userRaw));

>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
  if (!token || !userRaw) {
    throw new Error("Sign-in response was incomplete. Please try again.");
  }

  let user;
<<<<<<< HEAD
=======

>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Invalid sign-in response. Please try again.");
  }

<<<<<<< HEAD
  return { token, user };
};

// Opens Google/GitHub OAuth in a Custom Tab and waits only for the browser
// to close. It deliberately does NOT try to read the deep-link result
// itself — the redirect is captured by the persistent listener in
// app/_layout.jsx, which exists for the whole app session and isn't subject
// to the mount-timing race a screen-local or call-scoped listener runs
// into. A closed browser is never treated as a successful sign-in.
=======
  return {
    token,
    user,
  };
};

>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
export const signInWithProvider = async (provider) => {
  const authUrl = `${API_URL}/auth/${provider}?platform=mobile`;

  console.log("[OAUTH] AUTH URL:", authUrl);
  console.log("[OAUTH] REDIRECT:", REDIRECT_URL);

<<<<<<< HEAD
  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL);
  console.log("[OAUTH] BROWSER RESULT:", result?.type);
};
=======
  let subscription = null;
  let timeoutId = null;
  let finished = false;

  const cleanup = () => {
    if (subscription) {
      subscription.remove();
      subscription = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return new Promise((resolve, reject) => {
    const finish = (callback) => {
      if (finished) return;

      finished = true;
      cleanup();

      try {
        WebBrowser.dismissBrowser();
      } catch {}

      callback();
    };

    const handleCallback = (url) => {
      console.log("[OAUTH] URL RECEIVED:", url);

      if (!url || !url.startsWith(REDIRECT_URL)) {
        console.log("[OAUTH] URL IGNORED");
        return;
      }

      console.log("[OAUTH] CALLBACK ACCEPTED");

      finish(() => {
        try {
          const session = parseCallbackUrl(url);

          console.log("[OAUTH] SESSION PARSED");
          resolve(session);
        } catch (error) {
          console.log("[OAUTH] PARSE ERROR:", error);
          reject(error);
        }
      });
    };

    // Listen for Android deep-link callback.
    subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("[OAUTH] LINKING EVENT:", url);
      handleCallback(url);
    });

    // Check whether the app was opened directly with the callback URL.
    Linking.getInitialURL()
      .then((initialUrl) => {
        console.log("[OAUTH] INITIAL URL:", initialUrl);

        if (initialUrl) {
          handleCallback(initialUrl);
        }
      })
      .catch((error) => {
        console.log("[OAUTH] INITIAL URL ERROR:", error);
      });

    timeoutId = setTimeout(() => {
      if (finished) return;

      console.log("[OAUTH] CALLBACK TIMEOUT");

      finish(() => {
        reject(
          new Error("Google sign-in timed out. Please try again.")
        );
      });
    }, CALLBACK_TIMEOUT);

    // IMPORTANT:
    // Do NOT use openAuthSessionAsync here.
    // Android was returning "dismiss" before the callback reached JS.
    WebBrowser.openBrowserAsync(authUrl)
      .then((result) => {
        console.log("[OAUTH] BROWSER RESULT:", result);

        if (finished) return;

        // Browser closing is NOT treated as cancellation.
        // We continue waiting for the Linking callback.
        console.log(
          "[OAUTH] BROWSER CLOSED - WAITING FOR CALLBACK"
        );
      })
      .catch((error) => {
        console.log("[OAUTH] BROWSER ERROR:", error);

        finish(() => reject(error));
      });
  });
};
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
