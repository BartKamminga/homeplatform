import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Landing from "./Landing.jsx";

// Paginabezoek registreren
fetch("/api/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ site: __SITE__, path: window.location.pathname }),
}).catch(() => {}); // stilletjes falen als backend niet bereikbaar is

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
