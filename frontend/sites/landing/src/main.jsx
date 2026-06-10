import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@core/theme.css";
import "./styles.css";
import Landing from "./Landing.jsx";

import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";
import ErrorBoundary from "@components/ErrorBoundary.jsx";

initSentry();
trackEvent("landing", "page.view", { path: window.location.pathname });
loadTheme();
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary label="Landing">
      <Landing />
    </ErrorBoundary>
  </StrictMode>,
);
