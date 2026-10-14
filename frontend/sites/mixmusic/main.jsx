import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import "@core/theme.css";
import AuthGate from "@components/AuthGate.jsx";
import ErrorBoundary from "@components/ErrorBoundary.jsx";
import VariantRoot from "@components/VariantRoot.jsx";
import { trackEvent, loadTheme } from "@core/api.js";
import { initSentry } from "@core/sentry.js";
import EnvBanner from "@core/EnvBanner.jsx";

// Twee frontends naast elkaar (item 1339): classic (App.jsx + styles.css) en arcade, keuze per gebruiker.
const Classic = lazy(() => import("./ClassicRoot.jsx"));
const Arcade = lazy(() => import("./arcade/ArcadeRoot.jsx"));

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
        <VariantRoot site="mixmusic" classic={Classic} arcade={Arcade} />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
);
