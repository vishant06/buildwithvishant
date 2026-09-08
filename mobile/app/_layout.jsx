import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import { AppThemeProvider, useAppTheme } from "../context/ThemeContext.jsx";
import { REDIRECT_URL, parseCallbackUrl } from "../services/oauth.js";

// Keeps the native branded splash (the real BWV logo, configured in
// app.json) on screen until auth/session restoration and the saved theme
// preference have both finished loading — so there's never a flash of a
// blank or unstyled screen between "app opened" and "app usable".
SplashScreen.preventAutoHideAsync().catch(() => {});

// Owns the OAuth deep-link callback for the entire app session.
//
// Why this has to live here and not in app/auth/callback.jsx:
// Expo Router registers its own "url" listener from app boot (inside the
// NavigationContainer it sets up) to drive navigation. When the OAuth
// redirect arrives, THAT listener fires, matches the path to the
// app/auth/callback route, and dispatches a navigation action — which
// mounts the callback screen on a LATER render pass. Only then does that
// screen's own useEffect run and register its own Linking listener — by
// which point the single native "url" event has already fired and been
// fully consumed. A listener registered inside the destination screen is
// structurally always one tick too late to see the very event that caused
// it to be shown, on both warm resume and cold start.
//
// Registering the listener here instead — at the true root, mounted before
// any navigation happens and for the app's entire lifetime — guarantees it
// already exists by the time the redirect fires, regardless of which
// screen is current. It parses the fragment, applies the session, and
// navigates home itself; it doesn't depend on Router ever having matched
// or mounted any particular screen for buildwithvishant://auth/callback.
function OAuthCallbackListener() {
  const { applySession } = useAuth();
  const router = useRouter();
  const handledUrls = useRef(new Set());

  useEffect(() => {
    const handleUrl = (url) => {
      if (!url || !url.startsWith(REDIRECT_URL)) return;
      if (handledUrls.current.has(url)) return;
      handledUrls.current.add(url);

      console.log("[OAUTH] CALLBACK URL:", url);

      (async () => {
        try {
          const { token, user } = parseCallbackUrl(url);
          console.log("[OAUTH] SESSION PARSED");
          await applySession(token, user);
          console.log("[OAUTH] SESSION APPLIED - REDIRECTING HOME");
          router.replace("/");
        } catch (error) {
          console.log("[OAUTH] CALLBACK ERROR:", error.message);
          router.replace({ pathname: "/login", params: { oauthError: error.message } });
        }
      })();
    };

    // Cold start: the app process was launched directly by this deep link.
    Linking.getInitialURL()
      .then(handleUrl)
      .catch((error) => console.log("[OAUTH] INITIAL URL ERROR:", error));

    // Warm start: the app was already running when the redirect arrived.
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => subscription.remove();
  }, [applySession, router]);

  return null;
}

function SplashGate({ children }) {
  const { booting } = useAuth();
  const { ready: themeReady } = useAppTheme();

  useEffect(() => {
    if (!booting && themeReady) SplashScreen.hideAsync().catch(() => {});
  }, [booting, themeReady]);

  if (booting || !themeReady) return null; // native splash is still covering the screen at this point
  return children;
}

function ThemedStack() {
  const { colors, resolvedMode } = useAppTheme();

  return (
    <>
      <StatusBar style={resolvedMode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Log in" }} />
        <Stack.Screen name="signup" options={{ title: "Create account" }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="notes/[slug]" options={{ title: "" }} />
        <Stack.Screen name="projects" options={{ title: "Projects" }} />
        <Stack.Screen name="contact" options={{ title: "Contact" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider>
          <OAuthCallbackListener />
          <SplashGate>
            <ThemedStack />
          </SplashGate>
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
