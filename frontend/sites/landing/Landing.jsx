import { useEffect, useRef, useState } from "react";
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
      localStorage.setItem("hp_user", JSON.stringify({ id: data.user_id, username: data.username }));
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

const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

function getStoredUsername() {
  try { return JSON.parse(localStorage.getItem("hp_user") || "{}").username || ""; }
  catch { return ""; }
}

export default function Landing() {
  const [loggedIn,    setLoggedIn]    = useState(isTokenValid);
  const [username,    setUsername]    = useState(getStoredUsername);
  const [sites,       setSites]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [retryCount,  setRetryCount]  = useState(0);
  const [retrying,    setRetrying]    = useState(false);
  const [reloadKey,   setReloadKey]   = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!loggedIn) return;
    let attempt = 0;
    let cancelled = false;

    async function tryLoad() {
      if (cancelled) return;
      setLoading(true);
      setError("");
      setRetrying(false);
      try {
        const token = localStorage.getItem("hp_token");
        const r = await fetch("/api/sites", { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("Laden mislukt");
        const data = await r.json();
        if (!cancelled) { setSites(data); setLoading(false); setRetryCount(0); }
      } catch {
        if (cancelled) return;
        attempt++;
        setRetryCount(attempt);
        if (attempt >= MAX_RETRIES) {
          setError("Laden mislukt na 10 pogingen");
          setLoading(false);
        } else {
          setLoading(false);
          setRetrying(true);
          timerRef.current = setTimeout(tryLoad, RETRY_DELAY);
        }
      }
    }

    setRetryCount(0);
    setError("");
    tryLoad();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [loggedIn, reloadKey]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "560px", padding: "48px 24px" }}>

        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2rem" }}>
          Homeplatform
        </div>

        <h1 style={{ fontSize: "32px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px", letterSpacing: "-0.5px" }}>
          {loggedIn && username ? `Welkom, ${username}` : "Welkom"}
        </h1>

        {!loggedIn ? (
          <>
            <p style={{ fontSize: "15px", color: "var(--color-text-muted)", marginBottom: "2rem", lineHeight: 1.6 }}>
              Log in om verder te gaan
            </p>
            <LoginForm onLogin={() => { setLoggedIn(true); setUsername(getStoredUsername()); }} />
          </>
        ) : (
          <>
            <p style={{ fontSize: "15px", color: "var(--color-text-muted)", marginBottom: "2.5rem", lineHeight: 1.6 }}>
              Kies een applicatie om te starten
            </p>

            {loading && !retrying && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Laden...</p>
            )}
            {retrying && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginBottom: "10px" }}>
                  Verbinding verbroken — opnieuw proberen ({retryCount} van {MAX_RETRIES})
                </p>
                <div style={{ display: "flex", gap: "5px" }}>
                  {Array.from({ length: MAX_RETRIES }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: "4px", borderRadius: "2px",
                      background: i < retryCount ? "var(--color-primary)" : "var(--color-border)",
                      transition: "background 0.3s",
                    }} />
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ color: "#A32D2D", fontSize: "13px", marginBottom: "10px" }}>{error}</p>
                <button
                  onClick={() => setReloadKey(k => k + 1)}
                  style={{ fontSize: "13px", color: "var(--color-primary)", border: "1px solid var(--color-primary)", borderRadius: "var(--radius-md)", padding: "6px 14px", background: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Opnieuw proberen
                </button>
              </div>
            )}

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
                href="/account/profile"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "7px 14px", textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
              >
                👤 Account
              </a>
              <button
                onClick={() => { localStorage.removeItem("hp_token"); localStorage.removeItem("hp_user"); setLoggedIn(false); setSites([]); setUsername(""); }}
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
