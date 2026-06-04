import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { trackEvent } from "@core/api.js";


trackEvent(__SITE__, "page.view", { path: window.location.pathname });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
