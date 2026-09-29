import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { darkColors, lightColors } from "../constants/theme.js";

const STORAGE_KEY = "bwv_theme_mode"; // 'light' | 'dark' | 'system' — not sensitive, but SecureStore is already a dependency so there's no need to add AsyncStorage just for this.
const ThemeContext = createContext(null);

export function AppThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState("dark"); // sensible default before the stored value loads
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") setModeState(stored);
      })
      .finally(() => setReady(true));
  }, []);

  const setMode = (next) => {
    setModeState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  };

  const resolvedMode = mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;
  const colors = resolvedMode === "light" ? lightColors : darkColors;

  const value = useMemo(
    () => ({ mode, resolvedMode, colors, setMode, ready }),
    [mode, resolvedMode, colors, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within AppThemeProvider");
  return ctx;
};
