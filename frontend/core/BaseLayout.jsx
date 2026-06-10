// frontend/core/BaseLayout.jsx
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout, getCurrentUser } from "./auth.js";
import { loadTheme } from "./api.js";

export default function BaseLayout({
  children,
  navItems = [],
  siteTitle = "Admin",
}) {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light",
  );

  useEffect(() => {
    loadTheme();

    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute("data-theme") || "light");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  async function handleLogout() {
    await logout();
  }

  return (
    <div key={theme} style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "var(--sidebar-width)",
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          padding: "0",
          flexShrink: 0,
        }}
      >
        {/* Logo + home button */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-primary)" }}>
            {siteTitle}
          </span>
          <a
            href="/"
            title="Naar startpagina"
            style={{
              fontSize: "12px",
              color: "var(--color-text-muted)",
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ← Home
          </a>
        </div>

        {/* Navigatie */}
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 16px",
                fontSize: "var(--font-size-sm)",
                color: isActive
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
                background: isActive
                  ? "var(--color-primary-light)"
                  : "transparent",
                borderLeft: isActive
                  ? "3px solid var(--color-primary)"
                  : "3px solid transparent",
                textDecoration: "none",
                transition: "all .1s",
              })}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer: gebruiker + logout */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--color-border)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          <div
            style={{
              marginBottom: "8px",
              fontWeight: 500,
              color: "var(--color-text)",
            }}
          >
            {user?.username || "—"}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              fontSize: "var(--font-size-sm)",
              padding: "6px 10px",
              borderRadius: "var(--radius-md)",
              textAlign: "left",
            }}
          >
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Hoofdinhoud */}
      <main
        style={{
          flex: 1,
          padding: "32px",
          overflowY: "auto",
          background: "var(--color-background)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
