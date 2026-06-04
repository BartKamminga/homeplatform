import { useState, useEffect } from "react";
import { applyTheme, getActiveTheme } from "@core/api.js";

const THEMES = [
  { key: "light", label: "☀️ Licht" },
  { key: "dark", label: "🌙 Donker" },
  { key: "victoria", label: "⚜️ Victoria" },
  { key: "minimal", label: "◻ Minimal" },
  { key: "retro", label: "📻 Retro" },
];

export default function ThemeSwitcher({ compact = false }) {
  const [active, setActive] = useState(getActiveTheme);

  // Sync met body data-theme attribuut via MutationObserver
  useEffect(() => {
    // Zet initiële waarde
    setActive(document.body.getAttribute("data-theme") || getActiveTheme());

    // Luister op veranderingen
    const observer = new MutationObserver(() => {
      const theme = document.body.getAttribute("data-theme") || "light";
      setActive(theme);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  function handle(key) {
    applyTheme(key);
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {THEMES.map((t) => (
        <button
          key={t.key}
          onClick={() => handle(t.key)}
          style={{
            padding: compact ? "4px 8px" : "6px 12px",
            fontSize: compact ? 11 : 13,
            background:
              active === t.key
                ? "var(--color-primary)"
                : "var(--color-surface)",
            color: active === t.key ? "#fff" : "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            transition: "background .15s, color .15s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
