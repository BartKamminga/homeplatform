import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { loadTheme } from "@core/api.js";

// Paginabezoek registreren
fetch("/api/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ site: __SITE__, path: window.location.pathname }),
}).catch(() => {}); // stilletjes falen als backend niet bereikbaar is

// Laad platform thema-tokens als override bovenop styles.css
loadTheme();

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
