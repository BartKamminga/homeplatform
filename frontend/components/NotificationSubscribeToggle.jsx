import { useState, useEffect } from "react";
import { api } from "@core/api.js";

// Web Push aan/uit-knop (item 891) - generiek, bruikbaar op elke site die 'm
// mount (vergt alleen een geregistreerde service worker + de site-slug).
// Eerste gebruik: hockey-inside (VangerTab, naast Ghost/Scout-status).

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export default function NotificationSubscribeToggle({ site }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    api.get("/api/config").then((cfg) => {
      if (!cfg.vapid_public_key) return;
      setVapidPublicKey(cfg.vapid_public_key);
      setSupported(true);
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      );
    }).catch(() => {});
  }, []);

  async function handleToggle() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.post("/api/push/unsubscribe", { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setBusy(false); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        await api.post("/api/push/subscribe", {
          endpoint: sub.endpoint,
          keys: {
            p256dh: bufToBase64(sub.getKey("p256dh")),
            auth: bufToBase64(sub.getKey("auth")),
          },
          site,
        });
        setSubscribed(true);
      }
    } catch (e) {
      console.error("Push subscribe/unsubscribe mislukt", e);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      title={subscribed ? "Meldingen uitzetten" : "Meldingen aanzetten voor deze site"}
      style={{
        padding: "4px 10px", fontSize: 12, borderRadius: 99, cursor: busy ? "default" : "pointer",
        border: "1px solid var(--color-border)",
        background: subscribed ? "var(--color-primary)" : "var(--color-surface)",
        color: subscribed ? "#fff" : "var(--color-text-muted)",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {subscribed ? "🔔 Meldingen aan" : "🔕 Meldingen uit"}
    </button>
  );
}
