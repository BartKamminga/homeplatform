import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

//import "@core/theme.css";
import "./styles.css";

import { loadTheme } from "@core/api.js";
import { trackEvent } from "@core/api.js";

trackEvent(__SITE__, "page.view", { path: window.location.pathname });

// Laad platform thema-tokens als override bovenop styles.css
loadTheme();

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
