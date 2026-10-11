import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@core/api.js";
import { readOidcFragment, storeOidcToken } from "@core/oidc.js";
import Logo from "@core/Logo.jsx";
import OidcButtons from "@components/OidcButtons.jsx";

// Alleen relatieve paden als bestemming na Google/Microsoft-login.
function relativePath(url) {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : null;
  } catch {
    return null;
  }
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");

  // Terug van Google/Microsoft (item 1271): token opslaan en door naar de bestemming.
  useEffect(() => {
    const result = readOidcFragment();
    if (result.error) setError(result.error);
    if (result.token) {
      setLoading(true);
      storeOidcToken(result.token).then(() => {
        window.location.replace(relativePath(result.next) || "/admin/dashboard");
      });
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);

      if (redirect)
        setTimeout(() => {
          window.location.href = decodeURIComponent(redirect);
        }, 100);
      else navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-surface)",
      }}
    >
      <div
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "36px 32px",
          width: "100%",
          maxWidth: "380px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <Logo size={32} showName nameStyle={{ fontSize: 18, color: 'var(--color-text)' }} />
        </div>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
            marginBottom: "24px",
          }}
        >
          Admin
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                fontSize: "var(--font-size-sm)",
                marginBottom: "5px",
                fontWeight: 500,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "var(--font-size-sm)",
                marginBottom: "5px",
                fontWeight: 500,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div
              style={{
                background: "var(--color-danger-light)",
                color: "var(--color-danger)",
                borderRadius: "var(--radius-md)",
                padding: "9px 12px",
                fontSize: "var(--font-size-sm)",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "var(--color-primary)",
              color: "#fff",
              padding: "10px",
              fontWeight: 500,
              fontSize: "var(--font-size-md)",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <OidcButtons next={relativePath(redirect && decodeURIComponent(redirect)) || "/admin/dashboard"} />
      </div>
    </div>
  );
}
