import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api.js";

const REDIRECT_URL = "buildwithvishant://auth/callback";

const parseCallbackUrl = (url) => {
  console.log("[OAUTH] PARSING URL:", url);

  const fragment = url.split("#")[1] || "";
  const params = new URLSearchParams(fragment);

  const error = params.get("error");
  if (error) throw new Error(error);

  const token = params.get("token");
  const userRaw = params.get("user");

  console.log("[OAUTH] TOKEN EXISTS:", !!token);
  console.log("[OAUTH] USER EXISTS:", !!userRaw);

  if (!token || !userRaw) {
    throw new Error("Sign-in response was incomplete. Please try again.");
  }

  return {
    token,
    user: JSON.parse(userRaw),
  };
};

export const signInWithProvider = async (provider) => {
  const authUrl = `${API_URL}/auth/${provider}?platform=mobile`;

  console.log("[OAUTH] AUTH URL:", authUrl);
  console.log("[OAUTH] REDIRECT URL:", REDIRECT_URL);

  let settled = false;
  let subscription = null;

  return new Promise((resolve, reject) => {
    const finish = (fn) => {
      console.log("[OAUTH] FINISH CALLED");

      if (settled) return;

      settled = true;

      if (subscription) {
        subscription.remove();
        subscription = null;
      }

      WebBrowser.dismissBrowser();
      fn();
    };

    const handleUrl = (url) => {
      console.log("[OAUTH] CALLBACK URL:", url);

      if (!url || !url.startsWith(REDIRECT_URL)) {
        console.log("[OAUTH] CALLBACK URL IGNORED");
        return;
      }

      console.log("[OAUTH] CALLBACK URL ACCEPTED");

      finish(() => {
        try {
          resolve(parseCallbackUrl(url));
        } catch (err) {
          console.log("[OAUTH] PARSE ERROR:", err);
          reject(err);
        }
      });
    };

    subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("[OAUTH] LINKING URL EVENT:", url);
      handleUrl(url);
    });

    Linking.getInitialURL()
      .then((initialUrl) => {
        console.log("[OAUTH] INITIAL URL:", initialUrl);

        if (initialUrl) {
          handleUrl(initialUrl);
        }
      })
      .catch((err) => {
        console.log("[OAUTH] INITIAL URL ERROR:", err);
      });

    WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL)
      .then((result) => {
        console.log("[OAUTH] BROWSER RESULT:", result);

        if (settled) return;

        if (result.type === "success" && result.url) {
          handleUrl(result.url);
          return;
        }

        setTimeout(() => {
          if (!settled) {
            console.log("[OAUTH] NO CALLBACK RECEIVED - RESOLVING NULL");

            finish(() => resolve(null));
          }
        }, 2000);
      })
      .catch((err) => {
        console.log("[OAUTH] BROWSER ERROR:", err);

        if (!settled) {
          finish(() => reject(err));
        }
      });
  });
};