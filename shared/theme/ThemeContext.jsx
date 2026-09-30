import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readCookie, writeCookie } from '../auth/session.js';

const ThemeContext = createContext(null);

const THEME_KEY = 'portfolio_theme';
const THEME_COOKIE = 'bwv_theme';
const ONE_YEAR = 365 * 24 * 60 * 60;

const valid = (value) => (value === 'dark' || value === 'light' ? value : '');

// localStorage is per-app, so the choice is mirrored into a parent-domain
// cookie. That cookie is the most recent choice made in ANY app, so it wins;
// otherwise the saved local choice, then the OS preference, then dark.
const initialTheme = () => {
  const shared = valid(readCookie(THEME_COOKIE));
  if (shared) return shared;
  const saved = valid(localStorage.getItem(THEME_KEY));
  if (saved) return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    writeCookie(THEME_COOKIE, theme, ONE_YEAR);
  }, [theme]);

  // Pick up a change made in another app/tab when this one regains focus.
  useEffect(() => {
    const sync = () => {
      const shared = valid(readCookie(THEME_COOKIE));
      if (shared) setTheme(shared);
    };
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
