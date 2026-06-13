import { useState } from "react";
import { s, SITES, STATUSES, PRIORITIES, SCOPES, METER_VALUES, METER_COLOR, EMPTY_FORM } from "./roadmapConstants.js";
import { InputField, SelectField, TextareaField, FormGroup, FormLabel } from "../AdminFormFields.jsx";

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

export default function RoadmapItemForm({ initial, onSave, onCancel, saving }) {
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
      <div style={s.formActions}>
        <button type="button" style={s.btnSecondary} onClick={onCancel}>Annuleren</button>
        <button type="submit" style={{ ...s.btnPrimary, marginLeft: 0 }} disabled={saving}>
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
