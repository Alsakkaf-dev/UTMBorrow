import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: `${BASE}/api`, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("utmb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ---------------- Admin portal (MFA-elevated) client ----------------
   The admin portal uses a separate, short-lived elevated token minted after a
   TOTP step-up. It is injected here so it never mixes with the normal session.
   Enrolment calls (/admin/auth/elevate*) use the normal `api` client. */
export const ADMIN_TOKEN_KEY = "utmb_admin_token";

export const adminApi = axios.create({ baseURL: `${BASE}/api`, withCredentials: true });

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On any elevation failure, drop the token and let the portal re-gate.
adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    const code = err.response?.status;
    if (code === 401 || code === 403) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.dispatchEvent(new Event("admin-deauth"));
    }
    return Promise.reject(err);
  }
);

export const setAdminToken = (t) => {
  if (t) localStorage.setItem(ADMIN_TOKEN_KEY, t);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
};

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
