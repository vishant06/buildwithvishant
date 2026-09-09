import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import { AppThemeProvider, useAppTheme } from "../context/ThemeContext.jsx";

// Keeps the native branded splash (the real BWV logo, configured in
// app.json) on screen until auth/session restoration and the saved theme
// preference have both finished loading — so there's never a flash of a
// blank or unstyled screen between "app opened" and "app usable".
SplashScreen.preventAutoHideAsync().catch(() => {});

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
          <SplashGate>
            <ThemedStack />
          </SplashGate>
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
