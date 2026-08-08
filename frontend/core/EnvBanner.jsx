import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function EnvBanner() {
  const [env, setEnv] = useState(null);

  useEffect(() => {
    fetch("/api/config")
      .then(r => r.json())
      .then(d => setEnv(d.environment))
      .catch(() => {});
  }, []);

  if (!env || env === "production") return null;

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#ea580c", color: "#fff",
      fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em",
      textAlign: "center", padding: "5px 16px",
      fontFamily: "var(--font-mono, monospace)",
      textTransform: "uppercase",
      pointerEvents: "none",
    }}>
      ⚠ Acceptatie-omgeving · :8081 · wijzigingen hier zijn niet live
    </div>,
    document.body,
  );
}
