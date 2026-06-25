import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@core/theme.css";
import "./styles.css";
import App from "./App.jsx";
import AuthGate from "@components/AuthGate.jsx";
import ErrorBoundary from "@components/ErrorBoundary.jsx";
import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";

initSentry();
trackEvent("dontforget", "page.view", { path: window.location.pathname });
loadTheme();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/dontforget/sw.js', { scope: '/dontforget/' })
  })
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary label="DontForget">
      <AuthGate site="dontforget" siteName="DontForget">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
);
