// frontend/core/api.js
// Centrale fetch wrapper. Voegt automatisch de JWT Authorization header toe.

import * as Sentry from "@sentry/react";
import { reportError, reportMessage } from "@core/sentry.js";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const DEFAULT_THEME = "light";
const THEME_KEY = "hp_theme";

function getToken() {
  return localStorage.getItem("hp_token");
}

export function setToken(token) {
  localStorage.setItem("hp_token", token);
}

export function clearToken() {
  localStorage.removeItem("hp_token");
  localStorage.removeItem("hp_user");
}

export function parseToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    clearToken();
    return null;
  }
}

export function isTokenValid() {
  const token = localStorage.getItem("hp_token");
  if (!token) return false;
  const payload = parseToken(token);
  return payload ? payload.exp * 1000 > Date.now() : false;
}

export function trackEvent(site, action, details = {}) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site, action, details }),
  }).catch(() => {});
}

// Ververs token als het binnen 5 min verloopt (best-effort, stille fout)
async function maybeRefreshToken() {
  const token = localStorage.getItem("hp_token");
  if (!token) return;
  const payload = parseToken(token);
  if (!payload) return;
  const expiresInMs = payload.exp * 1000 - Date.now();
  if (expiresInMs > 0 && expiresInMs < 5 * 60 * 1000) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
      }
    } catch {
      // Stille fout
    }
  }
}

async function request(method, path, body = null) {
  await maybeRefreshToken();
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    reportMessage(`Sessie verlopen: ${method} ${path}`, "warning", { "api.path": path });
    clearToken();
    await Sentry.flush(1500);
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/admin/login?redirect=${returnUrl}`;
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map(d => d.msg).join('; ')
      : (err.detail || "Onbekende fout");
    const error = new Error(detail);
    reportError(error, { "api.method": method, "api.path": path, "api.status": res.status });
    throw error;
  }

  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};

// Synchroniseer inlogstatus over tabs via StorageEvent
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "hp_token") {
      if (!e.newValue && e.oldValue) {
        // Token verwijderd in andere tab → redirect naar login
        window.location.href = "/admin/login";
      } else if (e.newValue && !e.oldValue) {
        // Nieuw ingelogd in andere tab → herladen
        window.location.reload();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Inloggen mislukt");
  }
  const data = await res.json();
  setToken(data.access_token);
  localStorage.setItem(
    "hp_user",
    JSON.stringify({ id: data.user_id, username: data.username }),
  );
  return data;
}

// ---------------------------------------------------------------------------
// Thema
// ---------------------------------------------------------------------------

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

export function getActiveTheme() {
  return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
}

export async function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
    return;
  }

  try {
    const data = await fetch(`${BASE_URL}/api/admin/themes/active`).then((r) =>
      r.json(),
    );
    const themeName = data.name?.toLowerCase() || DEFAULT_THEME;
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_KEY, themeName);

    const tokens = data.tokens || {};
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  } catch {
    document.documentElement.setAttribute("data-theme", DEFAULT_THEME);
  }
}
