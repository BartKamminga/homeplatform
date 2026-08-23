import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@core/theme.css";
import App from "./App.jsx";
import AuthGate from "@components/AuthGate.jsx";
import ErrorBoundary from "@components/ErrorBoundary.jsx";
import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";
import EnvBanner from "@core/EnvBanner.jsx";

initSentry();
trackEvent("agent-control", "page.view", { path: window.location.pathname });
loadTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="Agent Control">
      <AuthGate site="agent-control" siteName="Agent Control">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
);
