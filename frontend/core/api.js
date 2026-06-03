// frontend/core/api.js
// Centrale fetch wrapper. Voegt automatisch de JWT Authorization header toe.

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

export function trackEvent(site, action, details = {}) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site, action, details }),
  }).catch(() => {});
}

async function request(method, path, body = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/admin/login";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Onbekende fout");
  }

  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};

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
  // 1. Lokale voorkeur heeft prioriteit
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) {
    document.body.setAttribute("data-theme", stored);
    return;
  }

  // 2. Platform thema ophalen uit database
  try {
    const data = await fetch(`${BASE_URL}/api/admin/themes/active`).then((r) =>
      r.json(),
    );
    // Gebruik theme naam als die beschikbaar is, anders tokens toepassen
    const themeName = data.name?.toLowerCase() || DEFAULT_THEME;
    document.body.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_KEY, themeName);

    // Extra tokens toepassen als die in de database staan
    const tokens = data.tokens || {};
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  } catch {
    // Geen backend beschikbaar — gebruik standaard thema
    document.body.setAttribute("data-theme", DEFAULT_THEME);
  }
}
