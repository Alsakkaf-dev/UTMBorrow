import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { connectRealtime, disconnectRealtime, onRealtime } from "../lib/realtime";
import { toast } from "../components/Toast";

// localStorage key holding the JWT (persists login across page reloads)
const TOKEN_KEY = "utmb_token";

// React context that exposes auth state + actions to the whole app
const AuthContext = createContext(null);

// Wrap the app in this so any component can call useAuth()
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // current logged-in user (null = signed out)
  const [loading, setLoading] = useState(true); // true while we verify a stored token on boot
  const [unread, setUnread] = useState(0);      // unread notification count (for the badge)
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const bootRef = useRef(false); // guard so the boot effect runs only once (React StrictMode double-mounts)

  // Re-fetch the unread notification count from the API
  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setUnread(data.unread || 0);
    } catch {
      /* ignore — unread badge is best-effort */
    }
  }, []);

  // Shared post-auth steps: persist token, set user, open the realtime stream, load unread
  const finishLogin = useCallback(
    (tok, u) => {
      localStorage.setItem(TOKEN_KEY, tok);
      setUser(u);
      connectRealtime(tok);
      refreshUnread();
    },
    [refreshUnread]
  );

  // Email/password login -> returns the user on success
  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/auth/login", { email, password });
      finishLogin(data.token, data.user);
      return data.user;
    },
    [finishLogin]
  );

  // Create a new account, then sign in with the returned token
  const register = useCallback(
    async (payload) => {
      const { data } = await api.post("/auth/register", payload);
      finishLogin(data.token, data.user);
      return data.user;
    },
    [finishLogin]
  );

  // Sign out: tell the server, then clear all local auth state
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */ // log out locally even if the server call fails
    }
    localStorage.removeItem(TOKEN_KEY);
    disconnectRealtime();
    setUser(null);
    setUnread(0);
  }, []);

  // Bootstrap the session from a stored token on first mount.
  useEffect(() => {
    if (bootRef.current) return; // already ran once
    bootRef.current = true;
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) {
      setLoading(false); // no token -> nothing to restore
      return;
    }
    (async () => {
      try {
        // Validate the token by fetching the current user
        const { data } = await api.get("/auth/me");
        setUser(data.user);
        connectRealtime(tok);
        refreshUnread();
      } catch {
        // Token invalid/expired -> discard it and stay signed out
        localStorage.removeItem(TOKEN_KEY);
        disconnectRealtime();
      } finally {
        setLoading(false); // boot done either way
      }
    })();
  }, [refreshUnread]);

  // Live notifications: bump the badge and surface a toast.
  useEffect(() => {
    const off = onRealtime("notification.new", (payload) => {
      setUnread((n) => n + 1);
      if (payload && payload.message) toast.info(payload.message);
    });
    return off; // unsubscribe on unmount
  }, []);

  // Everything exposed to consumers via useAuth()
  const value = { user, setUser, loading, unread, setUnread, refreshUnread, login, register, logout, token };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to read auth state/actions; errors if used outside <AuthProvider>
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default AuthContext;
