import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";
import { isTokenValid } from "@core/api.js";
import { isLoggedIn } from "@core/auth.js";

initSentry();

if (!isLoggedIn()) {
  const loginBase = "/admin/login";
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `${loginBase}?redirect=${returnUrl}`;
} else {
  trackEvent("dontforget", "page.view", { path: window.location.pathname });
  loadTheme();

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
