// Mirrors client/src/styles/global.css :root / [data-theme='light'] tokens
// exactly, so the app is recognizably the same product in either mode —
// not a separate "mobile palette".
export const darkColors = {
  mode: "dark",
  bg: "#07111f",
  bgSoft: "#0d1728",
  surface: "#16213a",
  surfaceSolid: "#111827",
  text: "#f8fafc",
  muted: "#94a3b8",
  border: "rgba(148, 163, 184, 0.2)",
  accent: "#38bdf8",
  accentStrong: "#0ea5e9",
  accentText: "#03121f",
  danger: "#fb7185",
  success: "#4ade80",
  warning: "#fbbf24",
  brandChip: "#0b1220",
};

export const lightColors = {
  mode: "light",
  bg: "#f8fafc",
  bgSoft: "#eef6ff",
  surface: "#ffffff",
  surfaceSolid: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "rgba(15, 23, 42, 0.12)",
  accent: "#38bdf8",
  accentStrong: "#0ea5e9",
  accentText: "#03121f",
  danger: "#fb7185",
  success: "#16a34a",
  warning: "#d97706",
  brandChip: "#0b1220",
};

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
export const spacing = (n) => n * 4;
export const fontSizes = { xs: 11, sm: 13, base: 15, lg: 17, xl: 20, xxl: 26 };
