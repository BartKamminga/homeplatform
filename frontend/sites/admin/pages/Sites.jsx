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
  const [sites, setSites] = useState([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    module: "",
    icon: "",
  });
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get("/api/admin/sites/")
      .then(setSites)
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

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

  const columns = [
    { key: "name", label: "Naam" },
    {
      key: "slug",
      label: "Slug",
      render: (v) => (
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            background: "var(--color-surface)",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
          }}
        >
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
      render: (v) => (
        <Badge
          label={v ? "Actief" : "Inactief"}
          variant={v ? "success" : "neutral"}
        />
      ),
    },
    {
      key: "_actions",
      label: "",
      render: (_, row) => (
        <button
          onClick={() => toggleSite(row)}
          style={{
            background: row.is_active
              ? "var(--color-warning-light)"
              : "var(--color-success-light)",
            color: row.is_active
              ? "var(--color-warning)"
              : "var(--color-success)",
            padding: "4px 10px",
            fontSize: "12px",
          }}
        >
          {row.is_active ? "Deactiveren" : "Activeren"}
        </button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600 }}>Sites</h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            {sites.length} sites geregistreerd
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            background: "var(--color-primary)",
            color: "#fff",
            padding: "9px 16px",
          }}
        >
          + Nieuwe site
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--color-danger)", marginBottom: "16px" }}>
          {error}
        </p>
      )}

      <div
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <Table
          columns={columns}
          rows={sites}
          emptyMessage="Geen sites geregistreerd"
        />
      </div>

      {showNew && (
        <Modal
          title="Nieuwe site registreren"
          onClose={() => setShowNew(false)}
        >
          {[
            ["name", "Naam"],
            ["slug", "Slug"],
            ["module", "Module naam"],
            ["icon", "Icoon (emoji of tekst)"],
          ].map(([field, label]) => (
            <div key={field} style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 500,
                  marginBottom: "5px",
                }}
              >
                {label}
              </label>
              <input
                value={form[field]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field]: e.target.value }))
                }
              />
            </div>
          ))}
          <ModalFooter>
            <BtnSecondary onClick={() => setShowNew(false)}>
              Annuleren
            </BtnSecondary>
            <BtnPrimary onClick={createSite} disabled={saving}>
              {saving ? "Opslaan..." : "Registreren"}
            </BtnPrimary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
