import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import AuthGate from "@components/AuthGate.jsx";
import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";

initSentry();
trackEvent("mixmusic", "page.view", { path: window.location.pathname });
loadTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate site="mixmusic" siteName="Mix Music">
      <App />
    </AuthGate>
  </StrictMode>,
);
