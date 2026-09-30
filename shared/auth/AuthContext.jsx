import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import request from '../api/request.js';
import { isMainSiteOrigin } from './sso.js';
import {
  LOCAL_SID,
  clearLocalSession,
  clearSession,
  ensureSid,
  getSid,
  getToken,
  getUser,
  readMarker,
  saveSession,
  saveUser,
} from './session.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getUser);

  const start = (nextToken, nextUser) => {
    saveSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  };

  const login = async (email, password, loginAs = 'user') => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, loginAs })
    });
    start(data.token, data.user);
  };

  const signup = async (form) => {
    let options;
    if (form.avatar) {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'confirmPassword' || key === 'loginAs') return;
        if (value !== null && value !== undefined && value !== '') payload.append(key, value);
      });
      options = { method: 'POST', body: payload };
    } else {
      const { confirmPassword, loginAs, avatar, ...rest } = form;
      options = { method: 'POST', body: JSON.stringify(rest) };
    }
    const data = await request('/auth/signup', options);
    start(data.token, data.user);
    return data;
  };

  const resendVerification = () => request('/auth/resend-verification', { method: 'POST' });

  const refreshUser = async () => {
    const data = await request('/auth/me');
    saveUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const completeOAuth = (oauthToken, oauthUser) => start(oauthToken, oauthUser);

  const logout = () => {
    clearSession();
    setToken(null);
    setUser(null);
  };

  // Keeps this app in step with the other two (and other tabs) using the
  // shared session marker cookie:
  //  - marker gone      -> somebody logged out -> drop our token
  //  - marker changed   -> a different login replaced ours -> drop our token
  //  - legacy main-site token with no marker yet -> adopt/create one
  useEffect(() => {
    const reconcile = () => {
      const currentToken = getToken();
      if (!currentToken) {
        setToken((value) => (value ? null : value));
        setUser((value) => (value ? null : value));
        return;
      }
      const marker = readMarker();
      const sid = getSid();

      if (sid === LOCAL_SID) return; // shared cookie unavailable: nothing to compare

      const signOutHere = () => {
        clearLocalSession();
        setToken(null);
        setUser(null);
      };

      if (!sid) {
        // Token from before the marker existed. Only the main site may
        // mint a marker; another app with an unexplained token drops it.
        if (!ensureSid({ create: isMainSiteOrigin() })) signOutHere();
        return;
      }
      if (!marker || marker !== sid) signOutHere();
    };

    reconcile();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    window.addEventListener('focus', reconcile);
    window.addEventListener('storage', reconcile);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', reconcile);
      window.removeEventListener('storage', reconcile);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, signup, completeOAuth, logout, resendVerification, refreshUser }),
    [token, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
