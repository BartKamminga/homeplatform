import { useState, useEffect } from "react";
import { applyTheme, getActiveTheme } from "@core/api.js";

const THEMES = [
  { key: "light",   bg: "linear-gradient(135deg, #fafaf8 50%, #ff3e6c 50%)", title: "Licht" },
  { key: "dark",    bg: "linear-gradient(135deg, #0a0a0f 50%, #e8ff47 50%)", title: "Donker" },
  { key: "minimal", bg: "linear-gradient(135deg, #ffffff 50%, #1a1a1a 50%)", title: "Minimal", border: "#ccc" },
  { key: "retro",   bg: "linear-gradient(135deg, #1a0f00 50%, #f5c842 50%)", title: "Retro" },
];

export default function ThemeSwitcher({ compact = false }) {
  const [active, setActive] = useState(getActiveTheme);

  useEffect(() => {
    // Init — lees van html element want applyTheme zet het daar
    const current = document.documentElement.getAttribute("data-theme") || getActiveTheme()
    setActive(current)

    // Observer op html element
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute("data-theme") || "light"
      setActive(theme)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })

    return () => observer.disconnect()
  }, [])

  function handle(key) {
    applyTheme(key)
    setActive(key) // direct updaten zonder wachten op observer
  }

  const size = compact ? 20 : 26;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {THEMES.map((t) => (
        <div
          key={t.key}
          title={t.title}
          onClick={() => handle(t.key)}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: t.bg,
            border: `2px solid ${active === t.key ? "var(--color-text, #1a1a1a)" : t.border || "transparent"}`,
            cursor: "pointer",
            transition: "border-color 0.2s, transform 0.15s",
            transform: active === t.key ? "scale(1.2)" : "scale(1)",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
