// frontend/core/BaseLayout.jsx
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { logout, getCurrentUser } from "./auth.js";
import { loadTheme } from "./api.js";
import GroupSwitcher from "@components/GroupSwitcher.jsx";
import Logo from "./Logo.jsx";

export default function BaseLayout({
  children,
  navItems = [],
  siteTitle = "Admin",
}) {
  const user = getCurrentUser();
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <style>{`
        @media (max-width: 767px) {
          .bl-sidebar {
            position: fixed !important;
            top: 0; left: 0;
            height: 100vh;
            z-index: 200;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
            box-shadow: 2px 0 12px rgba(0,0,0,0.15);
          }
          .bl-sidebar.bl-sidebar--open {
            transform: translateX(0);
          }
          .bl-overlay {
            display: block !important;
          }
          .bl-hamburger {
            display: flex !important;
          }
          .bl-main {
            padding: 16px !important;
          }
        }
        .bl-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 199;
        }
        .bl-hamburger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          margin-bottom: 16px;
          font-size: 20px;
          cursor: pointer;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text);
          flex-shrink: 0;
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="bl-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`bl-sidebar${sidebarOpen ? " bl-sidebar--open" : ""}`}
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
          <Logo size={22} showName nameStyle={{ fontSize: 13, color: 'var(--color-text)' }} />
          <a
            href="/landing/"
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

        {/* Footer: gebruiker + groepswisselaar + logout */}
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

          <div style={{ marginBottom: "8px" }}>
            <GroupSwitcher />
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
        className="bl-main"
        style={{
          flex: 1,
          padding: "32px",
          overflowY: "auto",
          background: "var(--color-background)",
        }}
      >
        <button
          className="bl-hamburger"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Menu openen"
        >
          ☰
        </button>
        {children}
      </main>
    </div>
  );
}
