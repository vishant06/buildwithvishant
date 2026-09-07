import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./api.js";

const REDIRECT_URL = "buildwithvishant://auth/callback";

const parseCallbackUrl = (url) => {
  console.log("[OAUTH] CALLBACK:", url);

  const fragment = url.split("#")[1] || "";
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
  console.log("[OAUTH] REDIRECT:", REDIRECT_URL);

  try {
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      REDIRECT_URL
    );

    console.log("[OAUTH] RESULT:", result);

    if (result.type !== "success" || !result.url) {
      return null;
    }

    return parseCallbackUrl(result.url);
  } catch (error) {
    console.log("[OAUTH] ERROR:", error);
    throw error;
  }
};