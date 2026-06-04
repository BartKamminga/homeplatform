import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@core/theme.css";
import "./styles.css";
import Landing from "./Landing.jsx";

import { trackEvent, loadTheme } from "@core/api.js";

trackEvent(__SITE__, "page.view", { path: window.location.pathname });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
