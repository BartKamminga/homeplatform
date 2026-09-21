import { useEffect, useState } from "react";
import AdminLayout from "../AdminLayout.jsx";
import Table from "@components/Table.jsx";
import Badge from "@components/Badge.jsx";
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from "@components/Modal.jsx";
import { api } from "@core/api.js";
import { useConfirm } from "@components/ConfirmDialog.jsx";

const EMPTY_FORM = {
  name: "", repo_url: "", host: "192.168.30.232", deploy_user: "",
  ports: "", forced_command: "", sudo_rule: "", notes: "",
};

const FIELDS = [
  ["name", "Naam", "input"],
  ["repo_url", "Repo-URL", "input"],
  ["deploy_user", "Deploy-gebruiker (unix)", "input"],
  ["host", "Host", "input"],
  ["ports", "Poort(en)", "input"],
  ["forced_command", "Forced command (authorized_keys)", "textarea"],
  ["sudo_rule", "Sudoers-regel", "textarea"],
  ["notes", "Notities", "textarea"],
];

export default function DeployGrants() {
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null); // grant of null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  function load() {
    api.get("/api/admin/deploy-grants/").then(setGrants).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function openEdit(grant) {
    setEditing(grant);
    setForm({ ...EMPTY_FORM, ...grant });
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/admin/deploy-grants/${editing.id}`, form);
      } else {
        await api.post("/api/admin/deploy-grants/", form);
      }
      setShowNew(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(grant) {
    try {
      await api.patch(`/api/admin/deploy-grants/${grant.id}`, {
        status: grant.status === "active" ? "revoked" : "active",
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(grant) {
    if (!(await confirm(`"${grant.name}" verwijderen uit het overzicht? Dit past niets aan op de server zelf.`))) return;
    try {
      await api.delete(`/api/admin/deploy-grants/${grant.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const columns = [
    { key: "name", label: "Naam" },
    {
      key: "repo_url", label: "Repo",
      render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>{v}</a> : "—",
    },
    { key: "deploy_user", label: "Deploy-gebruiker", render: (v) => <code style={{ fontSize: 12 }}>{v}</code> },
    { key: "ports", label: "Poort(en)" },
    { key: "status", label: "Status", render: (v) => <Badge label={v === "active" ? "actief" : "ingetrokken"} variant={v === "active" ? "success" : "neutral"} /> },
    {
      key: "_actions", label: "",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => openEdit(row)} style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", padding: "4px 10px", fontSize: 12 }}>Bekijken</button>
          <button onClick={() => toggleStatus(row)} style={{
            background: row.status === "active" ? "var(--color-warning-light)" : "var(--color-success-light)",
            color: row.status === "active" ? "var(--color-warning)" : "var(--color-success)",
            padding: "4px 10px", fontSize: 12,
          }}>{row.status === "active" ? "Intrekken" : "Heractiveren"}</button>
          <button onClick={() => remove(row)} style={{ background: "var(--color-danger-light)", color: "var(--color-danger)", padding: "4px 10px", fontSize: 12 }}>×</button>
        </div>
      ),
    },
  ];

  const modalOpen = showNew || !!editing;

  return (
    <AdminLayout>
      {confirmDialog}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Externe deploy-toegang</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            Overzicht van SSH-sleutels van externe (niet-homeplatform) repo's die iets op de G4 mogen
            deployen, met hun sudo-allowlist/forced-command-restrictie. Puur naslag — wijzigingen hier
            passen niets aan op de server zelf, dat blijft handmatig via SSH.
          </p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowNew(true); }} style={{ background: "var(--color-primary)", color: "#fff", padding: "9px 16px" }}>
          + Nieuwe deploy-toegang
        </button>
      </div>

      {error && <p style={{ color: "var(--color-danger)", marginBottom: 16 }}>{error}</p>}

      <div style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
        <Table columns={columns} rows={grants} emptyMessage="Nog geen externe deploy-toegang geregistreerd" />
      </div>

      {modalOpen && (
        <Modal title={editing ? `Deploy-toegang — ${editing.name}` : "Nieuwe deploy-toegang"} onClose={() => { setShowNew(false); setEditing(null); }} width={560}>
          {FIELDS.map(([field, label, kind]) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: 5 }}>{label}</label>
              {kind === "textarea" ? (
                <textarea rows={3} value={form[field] || ""} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12, resize: "vertical" }} />
              ) : (
                <input value={form[field] || ""} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <ModalFooter>
            <BtnSecondary onClick={() => { setShowNew(false); setEditing(null); }}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={save} disabled={saving}>{saving ? "Opslaan..." : "Opslaan"}</BtnPrimary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
