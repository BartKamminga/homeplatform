import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "@components/ErrorBoundary.jsx";
import "./styles.css";
import { loadTheme, trackEvent } from "@core/api.js";
import { initSentry } from "@core/sentry.js";

initSentry();
trackEvent("nkhockey", "page.view", { path: window.location.pathname });
loadTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary label="NK Hockey">
    <App />
  </ErrorBoundary>
);
