import { useEffect, useState } from "react";
import AdminLayout from "../AdminLayout.jsx";
import { api } from "@core/api.js";
import { useUiPref } from "@core/useUiPref.js";
import { useConfirm } from "@components/ConfirmDialog.jsx";
import RoadmapItemForm from "./RoadmapItemForm.jsx";
import RoadmapItemRow from "./RoadmapItemRow.jsx";
import { s, SITES, STATUSES, PRIORITIES, PRIORITY_LABEL, STATUS_CYCLE, STATUS_LABEL, STATUS_COLOR, STATUS_ORDER } from "./roadmapConstants.js";

const BULK_STATUSES = STATUSES.filter((v) => v !== "alle");

// navigator.clipboard bestaat alleen in secure contexts (HTTPS/localhost) -
// acc draait over plain HTTP op een LAN-IP, dus navigator.clipboard is daar
// undefined en navigator.clipboard.writeText() gooit synchroon (buiten de
// promise-chain, dus niet gevangen door .catch()). Fallback op de oudere
// execCommand('copy')-route via een tijdelijke textarea.
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      ok ? resolve() : reject(new Error("execCommand('copy') gaf false terug"));
    } catch (e) {
      document.body.removeChild(el);
      reject(e);
    }
  });
}

export default function Roadmap() {
  const [items, setItems] = useState([]);
  const [deployStatus, setDeployStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterSite, setFilterSite] = useUiPref("rm_site", "alle");
  const [filterStatus, setFilterStatus] = useUiPref("rm_status", "alle");
  const [filterPriority, setFilterPriority] = useUiPref("rm_priority", "alle");
  const [lastSite, setLastSite] = useUiPref("rm_last_site", "platform");
  const [search, setSearch] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, confirmDeleteDialog] = useConfirm();

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("pick_up");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    Promise.all([
      api.get("/api/roadmap"),
      api.get("/api/admin/deploy-status").catch(() => null),
    ]).then(([data, ds]) => {
      setItems(data);
      setDeployStatus(ds);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }

  async function handleCreate(form) {
    setSaving(true);
    try {
      const created = await api.post("/api/roadmap", form);
      setItems((prev) => [created, ...prev]);
      setLastSite(form.site);
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
    if (!(await confirmDelete(`"${item.title}" verwijderen?`))) return;
    try {
      await api.delete(`/api/roadmap/${item.id}`);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(visible.map((it) => it.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkStatus() {
    setBulkBusy(true);
    try {
      const ids = [...selectedIds];
      const updated = await Promise.all(
        ids.map((id) => api.patch(`/api/roadmap/${id}`, { status: bulkStatus }))
      );
      const byId = new Map(updated.map((u) => [u.id, u]));
      setItems((prev) => prev.map((it) => byId.get(it.id) || it));
    } catch (e) {
      setError(e.message);
    } finally {
      setBulkBusy(false);
    }
  }

  function handleCopyForClaude() {
    const selected = items.filter((it) => selectedIds.has(it.id));
    const text = selected.map((it) => `#${it.id} ${it.title}`).join("\n");
    copyText(text).then(() => {
      setCopyMsg(`${selected.length} item(s) gekopieerd`);
      setTimeout(() => setCopyMsg(""), 2500);
    }).catch(() => setError("Kopiëren naar klembord mislukt"));
  }

  const searchLower = search.trim().toLowerCase();
  const visible = items.filter((it) => {
    if (filterSite !== "alle" && it.site !== filterSite) return false;
    if (filterStatus !== "alle" && it.status !== filterStatus) return false;
    if (filterPriority !== "alle" && it.priority !== filterPriority) return false;
    if (searchLower && !(
      (it.title || "").toLowerCase().includes(searchLower) ||
      (it.description || "").toLowerCase().includes(searchLower) ||
      (it.notes || "").toLowerCase().includes(searchLower)
    )) return false;
    return true;
  });

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: visible.filter((it) => it.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <AdminLayout>
      <style>{`
        .rm-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
        .rm-filter-scroll { overflow-x: auto; flex-wrap: nowrap !important; padding-bottom: 2px; }
        .rm-filter-scroll::-webkit-scrollbar { display: none; }
        .rm-card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        @media (max-width: 600px) {
          .rm-card-actions { margin-left: 0 !important; margin-top: 6px; }
        }
      `}</style>

      <div className="rm-page-header">
        <div>
          <h1 style={s.header}>Roadmap</h1>
          <p style={s.subtitle}>Feature-planning en ontwikkelstatus per site</p>
        </div>
        <button
          style={s.btnPrimary}
          onClick={() => { setShowNewForm(true); setEditingId(null); }}
        >
          + Nieuw item
        </button>
      </div>

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

      <div style={s.filterRow}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Zoek in ${items.length} items…`}
          style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "13px", fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: "8px" }}
        />
      </div>

      <div style={s.filterBar}>
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Status</span>
          <div className="rm-filter-scroll" style={{ display: "flex", gap: "4px" }}>
            {STATUSES.map((v) => (
              <button key={v} style={s.filterBtn(filterStatus === v)} onClick={() => setFilterStatus(v)}>
                {v === "alle" ? "Alle" : STATUS_LABEL[v] || v}
              </button>
            ))}
          </div>
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
          <div className="rm-filter-scroll" style={{ display: "flex", gap: "4px" }}>
            {SITES.map((v) => (
              <button key={v} style={s.filterBtn(filterSite === v)} onClick={() => setFilterSite(v)}>
                {v === "alle" ? "Alle" : v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
        <button
          style={{ ...s.filterBtn(false), fontSize: "11px" }}
          onClick={selectedIds.size > 0 ? clearSelection : selectAllVisible}
        >
          {selectedIds.size > 0 ? `✕ Selectie wissen (${selectedIds.size})` : `☐ Selecteer alle zichtbare (${visible.length})`}
        </button>

        {selectedIds.size > 0 && (
          <>
            <button style={{ ...s.filterBtn(false) }} onClick={handleCopyForClaude}>
              📋 Kopieer voor Claude ({selectedIds.size})
            </button>
            {copyMsg && <span style={{ fontSize: "11px", color: "var(--color-success)" }}>{copyMsg}</span>}

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                style={{ width: "auto", padding: "4px 8px", fontSize: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontFamily: "inherit" }}
              >
                {BULK_STATUSES.map((v) => (
                  <option key={v} value={v}>{STATUS_LABEL[v] || v}</option>
                ))}
              </select>
              <button style={s.filterBtn(true)} onClick={handleBulkStatus} disabled={bulkBusy}>
                {bulkBusy ? "Bezig…" : `→ Status zetten (${selectedIds.size})`}
              </button>
            </div>
          </>
        )}
      </div>

      {showNewForm && (
        <RoadmapItemForm initialSite={lastSite} onSave={handleCreate} onCancel={() => setShowNewForm(false)} saving={saving} />
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
                deployStatus={deployStatus}
                onStatusCycle={handleStatusCycle}
                onEdit={(it) => { setEditingId(it.id); setShowNewForm(false); }}
                onDelete={handleDelete}
                selected={selectedIds.has(item.id)}
                onToggleSelect={toggleSelect}
              />
            )
          )}
        </div>
      ))}

      {confirmDeleteDialog}
    </AdminLayout>
  );
}
