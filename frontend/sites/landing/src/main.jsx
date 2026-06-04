import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Landing from "./Landing.jsx";

import { trackEvent } from "@core/api.js";

trackEvent(__SITE__, window.location.pathname);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
