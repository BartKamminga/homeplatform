import { useState, useEffect } from "react";
import * as Sentry from "@sentry/react";
import { api, getLastFailedRequest } from "@core/api.js";
import { uploadImageFile } from "@core/uploadImage.js";

// Bug-report-widget (item 887): vaste knop, alleen zichtbaar voor leden van
// de Admins-groep, op elke site (geimporteerd via ErrorBoundary.jsx - de
// enige plek die alle 13 sites al gemeenschappelijk importeren). Pakt bij
// het versturen automatisch een screenshot, de URL, browser/OS, recente
// console-fouten (via de al bestaande Sentry-integratie, sentry.js) en de
// laatst-mislukte API-call (core/api.js) mee, en maakt er direct een nieuw
// roadmap-item van via de bestaande POST /api/roadmap + POST /api/uploads
// (zelfde upload-mechanisme als item 639) - geen nieuwe backend nodig.

function getRecentBreadcrumbs(limit = 15) {
  try {
    const data = Sentry.getCurrentScope().getScopeData();
    return (data.breadcrumbs || [])
      .slice(-limit)
      .map((b) => `[${b.level || "info"}] ${b.category || ""}: ${b.message || JSON.stringify(b.data || {})}`)
      .join("\n");
  } catch {
    return "";
  }
}

function currentSiteSlug() {
  const seg = window.location.pathname.split("/").filter(Boolean)[0];
  return seg || "platform";
}

export default function ReportBugWidget() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/auth/me").then((me) => setIsAdmin(me?.groups?.includes("admins") ?? false)).catch(() => {});
  }, []);

  if (!isAdmin) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim() || sending) return;
    setSending(true);
    setError("");

    let imageUrl = null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, { logging: false, useCORS: true });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        const file = new File([blob], "bug-screenshot.png", { type: "image/png" });
        imageUrl = await uploadImageFile(file, "roadmap");
      }
    } catch {
      // Screenshot mislukken mag de melding zelf niet blokkeren.
    }

    const notesParts = [`URL: ${window.location.href}`, `Browser: ${navigator.userAgent}`];
    const lastFailed = getLastFailedRequest();
    if (lastFailed) {
      notesParts.push(`Laatste mislukte API-call: ${lastFailed.method} ${lastFailed.path} -> ${lastFailed.status} (${lastFailed.detail}) om ${lastFailed.ts}`);
    }
    const breadcrumbs = getRecentBreadcrumbs();
    if (breadcrumbs) notesParts.push(`Recente console-meldingen:\n${breadcrumbs}`);

    try {
      await api.post("/api/roadmap", {
        title: description.trim().slice(0, 80),
        description: description.trim(),
        site: currentSiteSlug(),
        priority: "medium",
        status: "idea",
        images: imageUrl ? JSON.stringify([imageUrl]) : null,
        notes: notesParts.join("\n\n"),
      });
      setDone(true);
      setDescription("");
      setTimeout(() => { setOpen(false); setDone(false); }, 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Bug melden"
          style={{
            position: "fixed", bottom: 16, right: 16, zIndex: 9998,
            width: 40, height: 40, borderRadius: "50%", border: "none",
            background: "#1a1a22", color: "#fff", fontSize: 18, cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 0,
          }}
        >
          🐛
        </button>
      )}

      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={(e) => e.target === e.currentTarget && !sending && setOpen(false)}
        >
          <div style={{ background: "var(--color-surface, #1a1a22)", borderRadius: 14, padding: "20px 22px", width: "100%", maxWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", fontFamily: "inherit" }}>
            {done ? (
              <div style={{ fontSize: 13, color: "var(--color-success, #22c55e)", textAlign: "center", padding: "20px 0" }}>
                ✓ Bug-item aangemaakt
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--color-text, #fff)" }}>🐛 Bug melden</div>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Wat ging er mis?"
                  rows={4}
                  disabled={sending}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--color-border, #333)", background: "var(--color-background, #111)", color: "var(--color-text, #fff)", fontFamily: "inherit", resize: "vertical", marginBottom: 8 }}
                />
                <div style={{ fontSize: 11, color: "var(--color-text-muted, #888)", marginBottom: 10 }}>
                  Screenshot, URL, browser en recente foutmeldingen worden automatisch meegestuurd.
                </div>
                {error && <div style={{ fontSize: 12, color: "var(--color-danger, #ef4444)", marginBottom: 8 }}>{error}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setOpen(false)} disabled={sending} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "transparent", border: "1px solid var(--color-border, #333)", color: "var(--color-text, #fff)", cursor: "pointer" }}>
                    Annuleren
                  </button>
                  <button type="submit" disabled={sending || !description.trim()} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--color-primary, #6366f1)", color: "#fff", border: "none", cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}>
                    {sending ? "Bezig…" : "Versturen"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
