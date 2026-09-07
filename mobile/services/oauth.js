import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api.js";

const REDIRECT_URL = "buildwithvishant://auth/callback";

const parseCallbackUrl = (url) => {
  const fragment = url.split("#")[1] || "";
  const params = new URLSearchParams(fragment);

  const error = params.get("error");
  if (error) throw new Error(error);

  const token = params.get("token");
  const userRaw = params.get("user");

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

  let settled = false;
  let subscription = null;

  return new Promise((resolve, reject) => {
    const finish = (fn) => {
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
      if (!url || !url.startsWith(REDIRECT_URL)) return;

      finish(() => {
        try {
          resolve(parseCallbackUrl(url));
        } catch (err) {
          reject(err);
        }
      });
    };

    subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          handleUrl(initialUrl);
        }
      })
      .catch(() => {});

    WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL)
      .then((result) => {
        if (settled) return;

        if (result.type === "success" && result.url) {
          handleUrl(result.url);
          return;
        }

        setTimeout(() => {
          if (!settled) {
            finish(() => resolve(null));
          }
        }, 2000);
      })
      .catch((err) => {
        if (!settled) {
          finish(() => reject(err));
        }
      });
  });
};