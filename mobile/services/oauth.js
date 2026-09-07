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

  const token = params.get("token");
  const userRaw = params.get("user");

  console.log("[OAUTH] TOKEN:", Boolean(token));
  console.log("[OAUTH] USER:", Boolean(userRaw));

  if (!token || !userRaw) {
    throw new Error(
      "Sign-in response was incomplete. Please try again."
    );
  }

  let user;

  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Invalid sign-in response. Please try again.");
  }

  return {
    token,
    user,
  };
};

export const signInWithProvider = (provider) => {
  const authUrl = `${API_URL}/auth/${provider}?platform=mobile`;

  console.log("[OAUTH] AUTH URL:", authUrl);
  console.log("[OAUTH] REDIRECT:", REDIRECT_URL);

  return new Promise((resolve, reject) => {
    let finished = false;
    let subscription = null;
    let timeoutId = null;

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

    // IMPORTANT:
    // Android is delivering the callback to MainActivity,
    // so listen for the deep-link event directly.
    subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("[OAUTH] LINKING EVENT:", url);
      handleCallback(url);
    });

    // Also handle the case where Android launches/resumes the app
    // with the callback URL already available.
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

    // Safety timeout so the Promise never hangs forever.
    timeoutId = setTimeout(() => {
      if (finished) return;

      console.log("[OAUTH] CALLBACK TIMEOUT");

      finish(() => {
        reject(
          new Error(
            "Google sign-in timed out. Please try again."
          )
        );
      });
    }, CALLBACK_TIMEOUT);

    WebBrowser.openAuthSessionAsync(
      authUrl,
      REDIRECT_URL
    )
      .then((result) => {
        console.log("[OAUTH] BROWSER RESULT:", result);

        if (finished) return;

        // Some Android/Expo combinations return the callback
        // through Linking while WebBrowser reports "dismiss".
        //
        // DO NOT resolve null here.
        if (result.type === "success" && result.url) {
          handleCallback(result.url);
          return;
        }

        if (result.type === "cancel") {
          finish(() => resolve(null));
          return;
        }

        // "dismiss":
        // Keep waiting for Linking callback.
        console.log(
          "[OAUTH] BROWSER DISMISSED - WAITING FOR LINKING CALLBACK"
        );
      })
      .catch((error) => {
        console.log("[OAUTH] BROWSER ERROR:", error);

        finish(() => reject(error));
      });
  });
};