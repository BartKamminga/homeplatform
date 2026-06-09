import { useEffect, useState } from "react";

function siteHref(site) {
  return `/${site.slug}/`;
}

export default function Landing() {
  const [sites, setSites]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then((data) => { setSites(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "560px", padding: "48px 24px" }}>

        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2rem" }}>
          Homeplatform
        </div>

        <h1 style={{ fontSize: "32px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px", letterSpacing: "-0.5px" }}>
          Welkom
        </h1>
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
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)";  e.currentTarget.style.transform = "translateY(0)"; }}
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

        <a
          href="/admin/"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "7px 14px", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
        >
          ⚙ Beheer
        </a>
      </div>
    </div>
  );
}
