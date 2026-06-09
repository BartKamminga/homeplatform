import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

//import "@core/theme.css";
import "./styles.css";

import App from "./App.jsx";

import { trackEvent, loadTheme } from "@core/api.js";

trackEvent("mixmusic", "page.view", { path: window.location.pathname });
loadTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
