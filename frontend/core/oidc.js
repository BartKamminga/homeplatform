// frontend/core/oidc.js
// Inloggen met Google/Microsoft (item 1271). De backend stuurt na afloop terug
// naar /admin/login (of het account) met het resultaat in het URL-fragment:
// #oidc_token=...&next=/pad, #oidc_error=... of #oidc_linked=google.

import { setToken } from "@core/api.js";

export const getOidcProviders = () =>
  fetch("/api/auth/oidc/providers").then((r) => (r.ok ? r.json() : [])).catch(() => []);

export const oidcLoginUrl = (provider, next) =>
  `/api/auth/oidc/${provider}/login?next=${encodeURIComponent(next || "/admin/dashboard")}`;

// Leest het fragment en haalt het meteen uit de adresbalk (token niet laten staan).
export function readOidcFragment() {
  const hash = window.location.hash.slice(1);
  if (!hash.includes("oidc_")) return {};
  const params = new URLSearchParams(hash);
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return {
    token: params.get("oidc_token"),
    next: params.get("next"),
    error: params.get("oidc_error"),
    linked: params.get("oidc_linked"),
  };
}

// Token opslaan zoals login() dat doet (incl. hp_user voor de UI).
export async function storeOidcToken(token) {
  setToken(token);
  const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) {
    const me = await res.json();
    localStorage.setItem("hp_user", JSON.stringify({ id: me.id, username: me.username }));
  }
}
