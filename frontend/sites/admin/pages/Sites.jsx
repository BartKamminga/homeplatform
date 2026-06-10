import { useEffect, useState } from "react";
import AdminLayout from "../AdminLayout.jsx";
import Table from "@components/Table.jsx";
import Badge from "@components/Badge.jsx";
import Modal, {
  ModalFooter,
  BtnPrimary,
  BtnSecondary,
} from "@components/Modal.jsx";
import { api } from "@core/api.js";

export default function Sites() {
  const [sites, setSites]       = useState([]);
  const [groups, setGroups]     = useState([]);
  const [error, setError]       = useState("");
  const [showNew, setShowNew]   = useState(false);
  const [accessSite, setAccessSite] = useState(null); // site waarvoor toegang wordt beheerd
  const [form, setForm]         = useState({ name: "", slug: "", module: "", icon: "" });
  const [saving, setSaving]     = useState(false);

  function load() {
    api.get("/api/admin/sites/").then(setSites).catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    api.get("/api/admin/groups/").then(setGroups).catch(() => {});
  }, []);

  async function toggleSite(site) {
    try {
      await api.patch(`/api/admin/sites/${site.id}/toggle`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function createSite() {
    setSaving(true);
    try {
      await api.post("/api/admin/sites/", form);
      setShowNew(false);
      setForm({ name: "", slug: "", module: "" });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccess(site, groupSlug, currently) {
    try {
      if (currently) {
        await api.delete(`/api/admin/sites/${site.id}/access/${groupSlug}`);
      } else {
        await api.post(`/api/admin/sites/${site.id}/access/${groupSlug}`);
      }
      load();
      // accessSite bijwerken met nieuwe data
      setAccessSite(prev => {
        if (!prev) return null;
        const next = currently
          ? prev.allowed_groups.filter(g => g !== groupSlug)
          : [...prev.allowed_groups, groupSlug];
        return { ...prev, allowed_groups: next };
      });
    } catch (e) {
      setError(e.message);
    }
  }

  const columns = [
    { key: "name", label: "Naam" },
    {
      key: "slug",
      label: "Slug",
      render: (v) => (
        <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px", background: "var(--color-surface)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>
          {v}
        </code>
      ),
    },
    { key: "module", label: "Module" },
    {
      key: "allowed_groups",
      label: "Toegang",
      render: (v) =>
        v.length ? (
          v.map((g) => <Badge key={g} label={g} variant="primary" />)
        ) : (
          <Badge label="iedereen" variant="neutral" />
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (v) => <Badge label={v ? "Actief" : "Inactief"} variant={v ? "success" : "neutral"} />,
    },
    {
      key: "_actions",
      label: "",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <a
            href={`/${row.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", padding: "4px 10px", fontSize: "12px", textDecoration: "none", borderRadius: "var(--radius-sm)" }}
          >
            ↗ Bezoeken
          </a>
          <button
            onClick={() => setAccessSite(row)}
            style={{ background: "var(--color-primary-light, #e8e8ff)", color: "var(--color-primary)", padding: "4px 10px", fontSize: "12px" }}
          >
            Toegang
          </button>
          <button
            onClick={() => toggleSite(row)}
            style={{
              background: row.is_active ? "var(--color-warning-light)" : "var(--color-success-light)",
              color: row.is_active ? "var(--color-warning)" : "var(--color-success)",
              padding: "4px 10px", fontSize: "12px",
            }}
          >
            {row.is_active ? "Deactiveren" : "Activeren"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600 }}>Sites</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            {sites.length} sites geregistreerd
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: "var(--color-primary)", color: "#fff", padding: "9px 16px" }}
        >
          + Nieuwe site
        </button>
      </div>

      {error && <p style={{ color: "var(--color-danger)", marginBottom: "16px" }}>{error}</p>}

      <div style={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
        <Table columns={columns} rows={sites} emptyMessage="Geen sites geregistreerd" />
      </div>

      {/* Nieuwe site modal */}
      {showNew && (
        <Modal title="Nieuwe site registreren" onClose={() => setShowNew(false)}>
          {[["name", "Naam"], ["slug", "Slug"], ["module", "Module naam"], ["icon", "Icoon (emoji of tekst)"]].map(([field, label]) => (
            <div key={field} style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "5px" }}>{label}</label>
              <input value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
            </div>
          ))}
          <ModalFooter>
            <BtnSecondary onClick={() => setShowNew(false)}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={createSite} disabled={saving}>{saving ? "Opslaan..." : "Registreren"}</BtnPrimary>
          </ModalFooter>
        </Modal>
      )}

      {/* Toegang beheren modal */}
      {accessSite && (
        <Modal title={`Toegang — ${accessSite.name}`} onClose={() => setAccessSite(null)}>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
            Geen groepen geselecteerd = toegankelijk voor alle ingelogde gebruikers.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groups.map(g => {
              const active = accessSite.allowed_groups.includes(g.slug);
              return (
                <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAccess(accessSite, g.slug, active)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <code style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{g.slug}</code>
                  <Badge label={`${g.member_count} leden`} variant="neutral" />
                </label>
              );
            })}
          </div>
          <ModalFooter>
            <BtnSecondary onClick={() => { setAccessSite(null); load(); }}>Sluiten</BtnSecondary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
