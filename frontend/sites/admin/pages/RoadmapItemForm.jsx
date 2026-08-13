import { useState, useRef } from "react";
import { s, SITES, STATUSES, PRIORITIES, SCOPES, METER_VALUES, METER_COLOR, EMPTY_FORM } from "./roadmapConstants.js";
import { InputField, SelectField, TextareaField, FormGroup, FormLabel } from "../AdminFormFields.jsx";

async function uploadImageFile(file) {
  const fd = new FormData();
  fd.append("file", file, file.name || "paste.png");
  const res = await fetch("/api/uploads?category=roadmap", {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: fd,
  });
  if (!res.ok) throw new Error("Upload mislukt");
  return (await res.json()).url;
}

function MeterField({ label, name, value, onChange }) {
  return (
    <FormGroup>
      <FormLabel>{label}</FormLabel>
      <div style={{ display: "flex", gap: "6px" }}>
        {[null, ...METER_VALUES].map((v) => {
          const active = value === v;
          const color = v ? METER_COLOR[v] : "var(--color-text-muted)";
          return (
            <button
              key={v ?? "geen"}
              type="button"
              onClick={() => onChange({ target: { name, value: v } })}
              style={{
                padding: "3px 10px", fontSize: "12px", borderRadius: "99px", cursor: "pointer",
                border: `1px solid ${active ? color : "var(--color-border)"}`,
                background: active ? color : "transparent",
                color: active ? "#fff" : "var(--color-text-muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {v ?? "—"}
            </button>
          );
        })}
      </div>
    </FormGroup>
  );
}

export default function RoadmapItemForm({ initial, onSave, onCancel, saving, initialSite }) {
  const [form,        setForm]        = useState(initial || (initialSite ? { ...EMPTY_FORM, site: initialSite } : EMPTY_FORM));
  const [localImages, setLocalImages] = useState(() => {
    try { return JSON.parse(initial?.images || "[]"); } catch { return []; }
  });
  const [uploading,   setUploading]   = useState(false);
  const [uploadErr,   setUploadErr]   = useState("");
  const fileRef = useRef(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, images: JSON.stringify(localImages) });
  }

  async function handleFiles(files) {
    const imgFiles = [...files].filter(f => f.type.startsWith("image/"));
    if (!imgFiles.length) return;
    setUploading(true); setUploadErr("");
    try {
      const urls = await Promise.all(imgFiles.map(uploadImageFile));
      setLocalImages(prev => [...prev, ...urls]);
    } catch { setUploadErr("Upload mislukt — probeer opnieuw"); }
    finally { setUploading(false); }
  }

  async function handlePaste(e) {
    const items = [...(e.clipboardData?.items || [])];
    const imgItem = items.find(i => i.type.startsWith("image/"));
    if (!imgItem) return;
    e.preventDefault();
    await handleFiles([imgItem.getAsFile()]);
  }

  return (
    <form style={s.form} onSubmit={handleSubmit} onPaste={handlePaste}>
      <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "14px" }}>
        {initial ? "Item bewerken" : "Nieuw roadmap-item"}
      </div>
      <div style={s.formGrid}>
        <InputField wide label="Titel *" name="title" value={form.title}
          onChange={handleChange} placeholder="Omschrijf het feature of de taak" autoFocus />
        <TextareaField label="Beschrijving" name="description" value={form.description}
          onChange={handleChange} placeholder="Optionele toelichting" />
        <SelectField label="Site" name="site" value={form.site} onChange={handleChange}
          options={SITES.filter((s) => s !== "alle")} />
        <SelectField label="Prioriteit" name="priority" value={form.priority} onChange={handleChange}
          options={PRIORITIES.filter((p) => p !== "alle")} />
        <SelectField label="Status" name="status" value={form.status} onChange={handleChange}
          options={STATUSES.filter((s) => s !== "alle")} />
        {form.status === "done" && (
          <FormGroup>
            <FormLabel>Versienummer <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(→ changelog)</span></FormLabel>
            <input style={s.input} name="version" value={form.version || ""} onChange={handleChange}
              placeholder="bijv. 0.8 of 1.3.1" />
          </FormGroup>
        )}
        <MeterField label="Impact op gebruiker" name="impact" value={form.impact} onChange={handleChange} />
        <MeterField label="Risk" name="risk" value={form.risk} onChange={handleChange} />
        <FormGroup>
          <FormLabel>Scope</FormLabel>
          <div style={{ display: "flex", gap: "6px" }}>
            {[null, ...SCOPES].map((v) => (
              <button
                key={v ?? "geen"}
                type="button"
                onClick={() => handleChange({ target: { name: "scope", value: v } })}
                style={{
                  padding: "3px 10px", fontSize: "12px", borderRadius: "99px", cursor: "pointer",
                  border: `1px solid ${form.scope === v ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: form.scope === v ? "var(--color-primary)" : "transparent",
                  color: form.scope === v ? "#fff" : "var(--color-text-muted)",
                  fontWeight: form.scope === v ? 600 : 400,
                }}
              >
                {v ?? "—"}
              </button>
            ))}
          </div>
        </FormGroup>
        <div style={{ gridColumn: "1 / -1" }} />
        <TextareaField label="Notities / Claude-context" name="notes" value={form.notes}
          onChange={handleChange}
          placeholder="Leg vast wat er gedaan is tijdens het werken — bij afsluiten gaat dit als omschrijving naar de changelog." />
      </div>
      {/* ── Afbeeldingen ── */}
      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 600 }}>
            Afbeeldingen
          </span>
          <button type="button" disabled={uploading}
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: "11px", padding: "3px 10px", borderRadius: "99px", cursor: "pointer",
              border: "1px solid var(--color-border)", background: "transparent",
              color: "var(--color-text-muted)", fontFamily: "inherit",
            }}
          >
            {uploading ? "Uploaden…" : "📷 Bladeren"}
          </button>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            of plak (Ctrl+V) een screenshot in het formulier
          </span>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {uploadErr && <div style={{ fontSize: "11px", color: "var(--color-danger)" }}>{uploadErr}</div>}

        {localImages.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {localImages.map((url, i) => (
              <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                <img src={url} alt="" onClick={() => window.open(url, "_blank")}
                  style={{ width: 88, height: 66, objectFit: "cover", borderRadius: "6px",
                    border: "1px solid var(--color-border)", cursor: "pointer", display: "block" }} />
                <button type="button"
                  onClick={() => setLocalImages(imgs => imgs.filter((_, j) => j !== i))}
                  style={{
                    position: "absolute", top: "-6px", right: "-6px",
                    width: "18px", height: "18px", borderRadius: "50%",
                    border: "none", background: "#dc2626", color: "#fff",
                    fontSize: "11px", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1,
                  }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={s.formActions}>
        <button type="button" style={s.btnSecondary} onClick={onCancel}>Annuleren</button>
        <button type="submit" style={{ ...s.btnPrimary, marginLeft: 0 }} disabled={saving}>
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
