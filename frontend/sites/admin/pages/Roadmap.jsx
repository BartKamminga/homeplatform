import { useEffect, useState } from "react";
import AdminLayout from "../AdminLayout.jsx";
import { api } from "@core/api.js";
import RoadmapItemForm from "./RoadmapItemForm.jsx";
import RoadmapItemRow from "./RoadmapItemRow.jsx";
import { s, SITES, STATUSES, PRIORITIES, PRIORITY_LABEL, STATUS_CYCLE, STATUS_LABEL, STATUS_COLOR, STATUS_ORDER } from "./roadmapConstants.js";

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

  useEffect(() => { load(); }, []);

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
    const newStatus = STATUS_CYCLE[item.status] || "idea";
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: newStatus } : it)));
    try {
      const updated = await api.patch(`/api/roadmap/${item.id}`, { status: newStatus });
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    } catch (e) {
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
          background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "13px",
        }}>
          {error}
          <button
            style={{ marginLeft: "12px", fontSize: "11px", cursor: "pointer", background: "none", border: "none", color: "inherit" }}
            onClick={() => setError("")}
          >✕</button>
        </div>
      )}

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

      {showNewForm && (
        <RoadmapItemForm onSave={handleCreate} onCancel={() => setShowNewForm(false)} saving={saving} />
      )}

      {loading && <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Laden…</p>}

      {!loading && visible.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Geen items gevonden.</p>
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
                <RoadmapItemForm
                  initial={item}
                  onSave={(form) => handleUpdate(item.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              </div>
            ) : (
              <RoadmapItemRow
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
