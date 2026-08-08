import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@core/theme.css";
import "./styles.css";
import App from "./App.jsx";
import AuthGate from "@components/AuthGate.jsx";
import ErrorBoundary from "@components/ErrorBoundary.jsx";
import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";
import EnvBanner from "@core/EnvBanner.jsx";

initSentry();
trackEvent("mixmusic", "page.view", { path: window.location.pathname });
loadTheme();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/mixmusic/sw.js', { scope: '/mixmusic/' })
  })
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="Mix Music">
      <AuthGate site="mixmusic" siteName="Mix Music">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
);
