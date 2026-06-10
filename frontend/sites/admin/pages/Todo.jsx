import AdminLayout from "../AdminLayout.jsx";

const ITEMS = [
  {
    site: "Platform",
    done: true,
    tasks: [
      { done: true,  text: "src/ uitflatten in alle sites" },
      { done: true,  text: "ErrorBoundary wiring in alle sites (incl. admin)" },
      { done: false, text: "Snelle task-toevoeg + muziek doorlopen over sites" },
    ],
  },
  {
    site: "Admin",
    done: false,
    tasks: [
      { done: true,  text: "Groepenbeheer UI (gebruiker ↔ groep)" },
      { done: true,  text: "Guest-groep + auto-assign bij registratie" },
      { done: true,  text: "Changelog read-only (beheerd via migraties)" },
      { done: true,  text: "Sites-pagina: directe link naar elke site" },
      { done: true,  text: "Todo-overzichtspagina (deze pagina)" },
    ],
  },
  {
    site: "MixMusic",
    done: false,
    tasks: [
      { done: true,  text: "Nieuwste tracks bovenaan + @eaDir filter" },
      { done: true,  text: "Sortering en filtering in de sidebar (genre, ★, ♥)" },
      { done: false, text: "Back-button in mobile gestapelde modus (terug naar lijst)" },
      { done: false, text: "Per-user settings met centrale merge (plan eerst)" },
      { done: false, text: "Waveform tonen (library kiezen)" },
    ],
  },
  {
    site: "DontForget",
    done: false,
    tasks: [
      { done: true,  text: "Login direct in de app" },
      { done: true,  text: "Toegang per groep instelbaar" },
      { done: false, text: "Alle settings werkend maken" },
      { done: false, text: "Koppeling platform — snel task toevoegen (context-gebonden)" },
    ],
  },
  {
    site: "NKHockey",
    done: true,
    tasks: [
      { done: true,  text: "NavFilter navigatie (competitie, fase, poule)" },
      { done: true,  text: "Simulaties als pure schakelaar" },
      { done: true,  text: "Platform-themas (Licht, Donker, Minimal, Retro)" },
    ],
  },
  {
    site: "NAS / Infrastructuur",
    done: false,
    tasks: [
      { done: false, text: "Externe toegang via DDNS" },
    ],
  },
  {
    site: "Uitgesteld",
    done: false,
    tasks: [
      { done: false, text: "Gmail-integratie" },
      { done: false, text: "Cast-setup (vereist HTTPS)" },
    ],
  },
];

const s = {
  page: { maxWidth: 700, margin: "0 auto", padding: "32px 24px" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 8, color: "var(--text)" },
  subtitle: { fontSize: 13, color: "var(--muted)", marginBottom: 32 },
  section: { marginBottom: 28 },
  siteHeader: {
    display: "flex", alignItems: "center", gap: 10,
    marginBottom: 10, padding: "6px 0",
    borderBottom: "1px solid var(--border)",
  },
  siteName: { fontWeight: 600, fontSize: 14, color: "var(--text)" },
  taskRow: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "5px 0", fontSize: 13,
  },
  check: (done) => ({
    width: 16, height: 16, flexShrink: 0, marginTop: 1,
    borderRadius: 4,
    background: done ? "var(--accent)" : "transparent",
    border: done ? "none" : "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, color: "#fff",
  }),
  taskText: (done) => ({
    color: done ? "var(--muted)" : "var(--text)",
    textDecoration: done ? "line-through" : "none",
    lineHeight: 1.5,
  }),
  badge: (done) => ({
    fontSize: 10, padding: "2px 7px", borderRadius: 9, flexShrink: 0,
    background: done ? "var(--accent)22" : "var(--bg3)",
    color: done ? "var(--accent)" : "var(--muted)",
    border: `1px solid ${done ? "var(--accent)44" : "var(--border)"}`,
  }),
};

function SiteSection({ site, tasks, done }) {
  const doneCount = tasks.filter(t => t.done).length;
  return (
    <div style={s.section}>
      <div style={s.siteHeader}>
        <span style={s.siteName}>{site}</span>
        <span style={s.badge(done)}>{doneCount}/{tasks.length}</span>
      </div>
      {tasks.map((t, i) => (
        <div key={i} style={s.taskRow}>
          <div style={s.check(t.done)}>{t.done ? "✓" : ""}</div>
          <span style={s.taskText(t.done)}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function Todo() {
  const total = ITEMS.flatMap(s => s.tasks).length;
  const done  = ITEMS.flatMap(s => s.tasks).filter(t => t.done).length;

  return (
    <AdminLayout>
      <div style={s.page}>
        <div style={s.title}>Ontwikkel-todo</div>
        <div style={s.subtitle}>
          {done}/{total} afgerond — bijgehouden door Claude, weerspiegelt de lopende sessie-afspraken.
        </div>
        {ITEMS.map(item => (
          <SiteSection key={item.site} {...item} />
        ))}
      </div>
    </AdminLayout>
  );
}
