import { useEffect, useState } from "react";
import AdminLayout from "../AdminLayout.jsx";
import { api } from "@core/api.js";

const SITES = ["alle", "platform", "landing", "admin", "account", "dontforget", "mixmusic", "nkhockey", "tournix", "fiets"];
const STATUSES = ["alle", "idee", "in_progress", "gereed", "deploying", "klaar"];
const PRIORITIES = ["alle", "hoog", "midden", "laag"];

const STATUS_CYCLE = { idee: "in_progress", in_progress: "gereed", gereed: "deploying", deploying: "klaar", klaar: "idee" };

const STATUS_LABEL = { idee: "Idee", in_progress: "In uitvoering", gereed: "Gereed voor deploy", deploying: "Deploying", klaar: "Klaar" };
const STATUS_COLOR = {
  idee: "var(--color-text-muted)",
  in_progress: "var(--color-primary)",
  gereed: "var(--color-warning)",
  deploying: "var(--color-danger)",
  klaar: "var(--color-success)",
};

const PRIORITY_LABEL = { hoog: "Hoog", midden: "Midden", laag: "Laag" };
const PRIORITY_STYLE = {
  hoog: { background: "var(--color-danger-light)", color: "var(--color-danger)" },
  midden: { background: "var(--color-warning-light)", color: "var(--color-warning)" },
  laag: { background: "var(--color-surface-2)", color: "var(--color-text-muted)" },
};

const EMPTY_FORM = {
  title: "",
  description: "",
  site: "platform",
  priority: "midden",
  status: "idee",
  notes: "",
  version: "",
};

/* ── Styles ─────────────────────────────────────────────────────────────── */

const s = {
  header: { fontSize: "22px", fontWeight: 600, marginBottom: "6px" },
  subtitle: { color: "var(--color-text-muted)", marginBottom: "24px", fontSize: "13px" },
  filterBar: {
    display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px",
  },
  filterRow: {
    display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center",
  },
  filterLabel: {
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--color-text-muted)",
    minWidth: "64px", flexShrink: 0,
  },
  filterBtn: (active) => ({
    padding: "4px 10px", fontSize: "12px", borderRadius: "99px", cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: active ? "var(--color-primary)" : "transparent",
    color: active ? "#fff" : "var(--color-text-muted)",
    fontWeight: active ? 600 : 400,
    transition: "background 0.1s, color 0.1s",
  }),
  btnPrimary: {
    padding: "7px 14px", fontSize: "13px", fontWeight: 600,
    borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
    background: "var(--color-primary)", color: "#fff",
    marginLeft: "auto",
  },
  card: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    marginBottom: "10px",
    overflow: "hidden",
  },
  cardBody: { padding: "14px 16px" },
  cardRow: {
    display: "flex", alignItems: "flex-start", gap: "10px",
  },
  badge: (style) => ({
    fontSize: "11px", padding: "2px 7px", borderRadius: "99px",
    fontWeight: 500, flexShrink: 0, ...style,
  }),
  statusDot: (status) => ({
    width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
    marginTop: "4px",
    background: STATUS_COLOR[status] || "var(--color-text-muted)",
    cursor: "pointer",
    border: "2px solid transparent",
    boxSizing: "border-box",
    transition: "box-shadow 0.15s",
  }),
  title: { fontWeight: 600, fontSize: "14px", flex: 1, lineHeight: 1.4 },
  desc: {
    fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: "6px", flexShrink: 0, marginLeft: "auto" },
  iconBtn: {
    padding: "4px 8px", fontSize: "12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)", background: "transparent",
    color: "var(--color-text-muted)", cursor: "pointer",
  },
  dangerBtn: {
    padding: "4px 8px", fontSize: "12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-danger)", background: "transparent",
    color: "var(--color-danger)", cursor: "pointer",
  },
  sectionLabel: {
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: "var(--color-text-light)",
    marginBottom: "8px", marginTop: "20px",
  },
  form: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    padding: "18px",
    marginBottom: "20px",
  },
  formGrid: {
    display: "grid", gap: "12px",
    gridTemplateColumns: "1fr 1fr",
  },
  formGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)" },
  input: {
    padding: "7px 10px", fontSize: "13px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)", background: "var(--color-background)",
    color: "var(--color-text)", width: "100%", boxSizing: "border-box",
  },
  textarea: {
    padding: "7px 10px", fontSize: "13px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)", background: "var(--color-background)",
    color: "var(--color-text)", width: "100%", boxSizing: "border-box",
    resize: "vertical", minHeight: "70px",
  },
  formActions: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "14px" },
  btnSecondary: {
    padding: "7px 14px", fontSize: "13px", fontWeight: 500,
    borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
    background: "transparent", color: "var(--color-text)", cursor: "pointer",
  },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div style={s.formGroup}>
      <label style={s.label}>{label}</label>
      <select style={s.input} name={name} value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function InputField({ label, name, value, onChange, placeholder }) {
  return (
    <div style={s.formGroup}>
      <label style={s.label}>{label}</label>
      <input
        style={s.input}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextareaField({ label, name, value, onChange, placeholder }) {
  return (
    <div style={{ ...s.formGroup, gridColumn: "1 / -1" }}>
      <label style={s.label}>{label}</label>
      <textarea
        style={s.textarea}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

/* ── Inline Form ─────────────────────────────────────────────────────────── */

function RoadmapForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  }

  return (
    <form style={s.form} onSubmit={handleSubmit}>
      <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "14px" }}>
        {initial ? "Item bewerken" : "Nieuw roadmap-item"}
      </div>
      <div style={s.formGrid}>
        <div style={{ ...s.formGroup, gridColumn: "1 / -1" }}>
          <label style={s.label}>Titel *</label>
          <input
            style={s.input}
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Omschrijf het feature of de taak"
            autoFocus
          />
        </div>
        <TextareaField
          label="Beschrijving"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Optionele toelichting"
        />
        <SelectField label="Site" name="site" value={form.site} onChange={handleChange}
          options={SITES.filter((s) => s !== "alle")} />
        <SelectField label="Prioriteit" name="priority" value={form.priority} onChange={handleChange}
          options={PRIORITIES.filter((p) => p !== "alle")} />
        <SelectField label="Status" name="status" value={form.status} onChange={handleChange}
          options={STATUSES.filter((s) => s !== "alle")} />
        {form.status === "klaar" && (
          <div style={s.formGroup}>
            <label style={s.label}>Versienummer <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(→ changelog)</span></label>
            <input
              style={s.input}
              name="version"
              value={form.version || ""}
              onChange={handleChange}
              placeholder="bijv. 0.8 of 1.3.1"
            />
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }} />
        <TextareaField
          label="Notities / Claude-context"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Leg vast wat er gedaan is tijdens het werken — bij afsluiten gaat dit als omschrijving naar de changelog."
        />
      </div>
      <div style={s.formActions}>
        <button type="button" style={s.btnSecondary} onClick={onCancel}>
          Annuleren
        </button>
        <button type="submit" style={{ ...s.btnPrimary, marginLeft: 0 }} disabled={saving}>
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}

/* ── Item row ────────────────────────────────────────────────────────────── */

function RoadmapItem({ item, onStatusCycle, onEdit, onDelete }) {
  const [hovering, setHovering] = useState(false);

  return (
    <div style={s.card}>
      <div style={s.cardBody}>
        <div style={s.cardRow}>
          {/* Status dot — click to cycle */}
          <div
            style={{
              ...s.statusDot(item.status),
              boxShadow: hovering ? `0 0 0 3px ${STATUS_COLOR[item.status]}33` : "none",
            }}
            title={`Status: ${STATUS_LABEL[item.status]} — klik om te wisselen`}
            onClick={() => onStatusCycle(item)}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={s.title}>{item.title}</span>
              <span style={s.badge(PRIORITY_STYLE[item.priority] || {})}>
                {PRIORITY_LABEL[item.priority] || item.priority}
              </span>
              <span style={{
                ...s.badge({ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }),
              }}>
                {item.site}
              </span>
              <span style={{
                fontSize: "11px", color: STATUS_COLOR[item.status],
                fontWeight: 500,
              }}>
                {STATUS_LABEL[item.status]}
              </span>
              {item.version && (
                <span style={s.badge({ background: "var(--color-success-light)", color: "var(--color-success)", fontFamily: "var(--font-mono)" })}>
                  v{item.version}
                </span>
              )}
            </div>
            {item.description && (
              <div style={s.desc}>{item.description}</div>
            )}
          </div>
          <div style={s.actions}>
            <button style={s.iconBtn} onClick={() => onEdit(item)} title="Bewerken">
              ✎
            </button>
            <button style={s.dangerBtn} onClick={() => onDelete(item)} title="Verwijderen">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

const STATUS_ORDER = ["deploying", "in_progress", "gereed", "idee", "klaar"];

export default function Roadmap() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterSite, setFilterSite] = useState("alle");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterPriority, setFilterPriority] = useState("alle");

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    api.get("/api/roadmap")
      .then((data) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }

  async function handleCreate(form) {
    setSaving(true);
    try {
      const created = await api.post("/api/roadmap", form);
      setItems((prev) => [created, ...prev]);
      setShowNewForm(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id, patch) {
    setSaving(true);
    try {
      const updated = await api.patch(`/api/roadmap/${id}`, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusCycle(item) {
    const newStatus = STATUS_CYCLE[item.status] || "idee";
    // Optimistic update
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: newStatus } : it)));
    try {
      const updated = await api.patch(`/api/roadmap/${item.id}`, { status: newStatus });
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    } catch (e) {
      // Rollback
      setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
      setError(e.message);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`"${item.title}" verwijderen?`)) return;
    try {
      await api.delete(`/api/roadmap/${item.id}`);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const visible = items.filter((it) => {
    if (filterSite !== "alle" && it.site !== filterSite) return false;
    if (filterStatus !== "alle" && it.status !== filterStatus) return false;
    if (filterPriority !== "alle" && it.priority !== filterPriority) return false;
    return true;
  });

  // Group by status, in defined order
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: visible.filter((it) => it.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <AdminLayout>
      <h1 style={s.header}>Roadmap</h1>
      <p style={s.subtitle}>Feature-planning en ontwikkelstatus per site</p>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: "16px",
          background: "var(--color-danger-light)", color: "var(--color-danger)",
          fontSize: "13px",
        }}>
          {error}
          <button
            style={{ marginLeft: "12px", fontSize: "11px", cursor: "pointer", background: "none", border: "none", color: "inherit" }}
            onClick={() => setError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div style={s.filterBar}>
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Status</span>
          {STATUSES.map((v) => (
            <button key={v} style={s.filterBtn(filterStatus === v)} onClick={() => setFilterStatus(v)}>
              {v === "alle" ? "Alle" : STATUS_LABEL[v] || v}
            </button>
          ))}
        </div>
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Prioriteit</span>
          {PRIORITIES.map((v) => (
            <button key={v} style={s.filterBtn(filterPriority === v)} onClick={() => setFilterPriority(v)}>
              {v === "alle" ? "Alle" : PRIORITY_LABEL[v] || v}
            </button>
          ))}
        </div>
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Site</span>
          {SITES.map((v) => (
            <button key={v} style={s.filterBtn(filterSite === v)} onClick={() => setFilterSite(v)}>
              {v === "alle" ? "Alle" : v}
            </button>
          ))}
          <button
            style={{ ...s.btnPrimary, marginLeft: "auto" }}
            onClick={() => { setShowNewForm(true); setEditingId(null); }}
          >
            + Nieuw item
          </button>
        </div>
      </div>

      {/* New item form */}
      {showNewForm && (
        <RoadmapForm
          onSave={handleCreate}
          onCancel={() => setShowNewForm(false)}
          saving={saving}
        />
      )}

      {loading && (
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Laden…</p>
      )}

      {!loading && visible.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Geen items gevonden.
        </p>
      )}

      {!loading && grouped.map(({ status, items: groupItems }) => (
        <div key={status}>
          <div style={s.sectionLabel}>
            <span style={{ color: STATUS_COLOR[status] }}>●</span>{" "}
            {STATUS_LABEL[status]} ({groupItems.length})
          </div>
          {groupItems.map((item) =>
            editingId === item.id ? (
              <div key={item.id} style={{ marginBottom: "10px" }}>
                <RoadmapForm
                  initial={item}
                  onSave={(form) => handleUpdate(item.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              </div>
            ) : (
              <RoadmapItem
                key={item.id}
                item={item}
                onStatusCycle={handleStatusCycle}
                onEdit={(it) => { setEditingId(it.id); setShowNewForm(false); }}
                onDelete={handleDelete}
              />
            )
          )}
        </div>
      ))}
    </AdminLayout>
  );
}
