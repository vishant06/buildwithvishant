import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../services/auth.js";
import { registerUnauthorizedHandler, tokenStore } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Any 401 from anywhere in the app clears the session immediately —
  // registered once, independent of React render cycles.
  useEffect(() => {
    registerUnauthorizedHandler(() => setUser(null));
  }, []);

  // On app start: if a token is already in SecureStore, validate it
  // against /auth/me instead of trusting it blindly.
  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) return setBooting(false);
      try {
        const data = await authApi.me();
        setUser(data.user);
      } catch (_error) {
        await tokenStore.clear();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    await tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  };

  const signup = async (payload) => {
    const data = await authApi.signup(payload);
    await tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  };

  // Used after a successful OAuth round-trip, where the token/user already
  // came back from the backend via the deep link rather than a form submit.
  const applySession = async (token, user) => {
    await tokenStore.set(token);
    setUser(user);
  };

  const logout = async () => {
    await tokenStore.clear();
    setUser(null);
  };

<<<<<<< HEAD
  const resendVerification = () => authApi.resendVerification();

  // Re-fetches the current user (e.g. after verifying an email on the web
  // in a browser tab, then coming back to the app) so isEmailVerified and
  // other server-side fields reflect what actually happened.
  const refreshUser = async () => {
    const data = await authApi.me();
    setUser(data.user);
    return data.user;
  };

=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
  return (
    <AuthContext.Provider
      value={{
        user,
        booting,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === "admin",
        login,
        signup,
        applySession,
        logout,
<<<<<<< HEAD
        resendVerification,
        refreshUser,
=======
>>>>>>> 92e5a8ccbe7cbf404df3af14ba462e3cefca9764
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
