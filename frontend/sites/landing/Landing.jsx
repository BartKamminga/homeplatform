import { useEffect, useState } from "react";
import { isTokenValid, setToken } from "@core/api.js";

function siteHref(site) {
  return `/${site.slug}/`;
}

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const body = new URLSearchParams({ username, password, grant_type: "password" });
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error("Ongeldige inloggegevens");
      const data = await res.json();
      setToken(data.access_token);
      onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <label style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px" }}>
          Gebruikersnaam
        </label>
        <input
          value={username} onChange={e => setUsername(e.target.value)}
          autoFocus autoComplete="username"
          style={{ width: "100%", padding: "10px 12px", fontSize: "14px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-background)", color: "var(--color-text)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px" }}>
          Wachtwoord
        </label>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ width: "100%", padding: "10px 12px", fontSize: "14px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-background)", color: "var(--color-text)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
        />
      </div>
      {error && (
        <p style={{ fontSize: "13px", color: "#A32D2D", margin: 0 }}>{error}</p>
      )}
      <button
        type="submit" disabled={loading}
        style={{ padding: "10px", fontSize: "14px", fontWeight: 500, borderRadius: "var(--radius-md)", border: "none", background: "var(--color-primary)", color: "#fff", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}
      >
        {loading ? "Inloggen..." : "Inloggen"}
      </button>
    </form>
  );
}

export default function Landing() {
  const [loggedIn, setLoggedIn] = useState(isTokenValid);
  const [sites,    setSites]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true); setError("");
    const token = localStorage.getItem("hp_token");
    fetch("/api/sites", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error("Laden mislukt"); return r.json(); })
      .then(data => { setSites(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [loggedIn]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "560px", padding: "48px 24px" }}>

        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2rem" }}>
          Homeplatform
        </div>

        <h1 style={{ fontSize: "32px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px", letterSpacing: "-0.5px" }}>
          Welkom
        </h1>

        {!loggedIn ? (
          <>
            <p style={{ fontSize: "15px", color: "var(--color-text-muted)", marginBottom: "2rem", lineHeight: 1.6 }}>
              Log in om verder te gaan
            </p>
            <LoginForm onLogin={() => setLoggedIn(true)} />
          </>
        ) : (
          <>
            <p style={{ fontSize: "15px", color: "var(--color-text-muted)", marginBottom: "2.5rem", lineHeight: 1.6 }}>
              Kies een applicatie om te starten
            </p>

            {loading && <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Laden...</p>}
            {error   && <p style={{ color: "#A32D2D", fontSize: "13px" }}>{error}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "12px", marginBottom: "2.5rem" }}>
              {sites.map((site) => (
                <a
                  key={site.slug}
                  href={siteHref(site)}
                  style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "20px 16px", textDecoration: "none", display: "block", transition: "border-color 0.15s, transform 0.1s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)";  e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "var(--radius-md)", background: "var(--color-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", marginBottom: "14px" }}>
                    {site.icon || "◈"}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginBottom: "4px" }}>
                    {site.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    /{site.slug}
                  </div>
                </a>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <a
                href="/admin/"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "7px 14px", textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
              >
                ⚙ Beheer
              </a>
              <button
                onClick={() => { localStorage.removeItem("hp_token"); setLoggedIn(false); setSites([]); }}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "7px 14px", background: "none", cursor: "pointer", fontFamily: "inherit" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
              >
                ↩ Uitloggen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
