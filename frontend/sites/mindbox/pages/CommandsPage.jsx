import { useEffect, useState } from 'react'
import { listCommands, createCommand, updateCommand, deleteCommand, listActions } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import CommandStepsEditor from './CommandStepsEditor.jsx'
import { labelStyle, fieldStyle, iconBtnStyle } from './commandStyles.js'

// Item 1053: referentie van entities + hun bekende velden uit backend/
// models/mindbox.py, puur informatief bij het samenstellen van een commando
// - welke elementaire actie (indien aanwezig) hoort bij welk veld.
const ENTITIES = [
  { key: '', label: '— geen (globaal) —', properties: [] },
  { key: 'Case', label: 'Case', properties: [
    { key: 'name', label: 'naam', action: null },
    { key: 'context_id', label: 'gekoppelde context', action: null },
  ] },
  { key: 'File', label: 'File (Item)', properties: [
    { key: 'status', label: 'status', action: 'Status' },
    { key: 'notes', label: 'notities (Bart)', action: 'Note' },
    { key: 'parsed_text', label: 'geparste tekst', action: 'ParsedText' },
    { key: 'contacts', label: 'gekoppelde contacten', action: 'Contact' },
    { key: 'case_id', label: 'gekoppelde case', action: null },
    { key: 'parent_item_id', label: 'parent (bijlage van)', action: 'UploadAttachment' },
  ] },
  { key: 'Context', label: 'Context', properties: [
    { key: 'name', label: 'naam', action: null },
    { key: 'content', label: 'inhoud', action: null },
  ] },
  { key: 'Contact', label: 'Contact', properties: [
    { key: 'email', label: 'e-mailadres', action: null },
    { key: 'display_name', label: 'weergavenaam', action: 'Contact' },
    { key: 'notes', label: 'profiel-notitie', action: 'ContactNote' },
  ] },
  { key: 'Response', label: 'Response', properties: [
    { key: 'content', label: 'inhoud', action: 'Respond' },
    { key: 'parent_response_id', label: 'vervolg op', action: 'Respond' },
  ] },
  { key: 'CaseEvent', label: 'Case Event (tijdlijn)', properties: [
    { key: 'event_type', label: 'type', action: 'AddEvent' },
    { key: 'description', label: 'omschrijving', action: 'AddEvent' },
  ] },
]

const EMPTY_STEP = { kind: 'api_call', action_key: 'Run', instruction: '', cli_hint: '' }
const EMPTY_FORM = { entity: '', action: '', param_kind: 'none', icon: '', description: '', steps: [{ ...EMPTY_STEP }] }

function notationPreview(form) {
  const head = form.entity ? `{env}.MindBox.${form.entity}.${form.action || '...'}` : `{env}.MindBox.${form.action || '...'}`
  if (form.param_kind === 'id') return `${head}(#id)`
  if (form.param_kind === 'name') return `${head}(naam)`
  if (!form.entity && form.action === 'Run') return `${head}(all)`
  return `${head}()`
}

export default function CommandsPage() {
  const [commands, setCommands] = useState([])
  const [actions, setActions] = useState([])
  const [editing, setEditing] = useState(null) // null=gesloten, {}=nieuw, object=bewerken
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [confirmAction, confirmDialog] = useConfirm()

  function load() {
    listCommands().then(setCommands).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    listActions().then(setActions).catch(() => {})
  }, [])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditing({})
  }

  function openEdit(command) {
    setForm({
      entity: command.entity || '', action: command.action, param_kind: command.param_kind,
      icon: command.icon || '', description: command.description || '',
      steps: command.steps.map(s => ({ ...s })),
    })
    setEditing(command)
  }

  // Makkelijk uitbreiden: een bestaand commando als basis voor een nieuwe
  // nemen (bv. File.Enhance dupliceren naar File.Archive) i.p.v. steeds
  // vanaf niets te beginnen - editing blijft {} (nieuw), dus Opslaan
  // maakt een NIEUW commando, geen update van het origineel.
  function duplicate(command) {
    setForm({
      entity: command.entity || '', action: '', param_kind: command.param_kind,
      icon: command.icon || '', description: command.description || '',
      steps: command.steps.map(s => ({ ...s })),
    })
    setEditing({})
  }

  async function save() {
    if (!form.action.trim() || !form.steps.some(s => s.instruction.trim())) return
    const data = {
      entity: form.entity || null, action: form.action.trim(), param_kind: form.param_kind,
      notation_template: notationPreview(form), icon: form.icon || undefined,
      description: form.description || null,
      steps: form.steps.filter(s => s.instruction.trim()),
    }
    if (editing?.id) {
      await updateCommand(editing.id, data)
    } else {
      await createCommand(data)
    }
    setEditing(null)
    load()
  }

  async function remove(command) {
    if (!(await confirmAction(`Commando "${command.notation_key}" verwijderen?`))) return
    await deleteCommand(command.id)
    load()
  }

  function setStep(i, patch) {
    setForm(f => ({ ...f, steps: f.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }))
  }
  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, { ...EMPTY_STEP }] }))
  }
  function removeStep(i) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
  }
  function moveStep(i, dir) {
    setForm(f => {
      const j = i + dir
      if (j < 0 || j >= f.steps.length) return f
      const steps = [...f.steps]
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...f, steps }
    })
  }

  const entityProps = ENTITIES.find(e => e.key === form.entity)?.properties || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={openNew} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: '#fff' }}>
          + Nieuw commando
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          De catalogus die MindBox.ps1s -Explain uitleest - nieuwe commandos hoeven niet meer in code.
        </span>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {editing && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Entity (optioneel)</label>
              <select value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value }))} style={fieldStyle}>
                {ENTITIES.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Actie</label>
              <input value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} placeholder="bv. Run, Enhance..." style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Parameter</label>
              <select value={form.param_kind} onChange={e => setForm(f => ({ ...f, param_kind: e.target.value }))} style={fieldStyle}>
                <option value="none">geen</option>
                <option value="id">#id</option>
                <option value="name">naam</option>
              </select>
            </div>
          </div>

          {!!entityProps.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', marginBottom: 12, background: 'var(--color-surface-2)', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: '100%' }}>Bekende velden op {form.entity}:</span>
              {entityProps.map(p => (
                <span key={p.key} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                  {p.label} {p.action
                    ? <b style={{ color: 'var(--color-success)' }}>→ -{p.action}</b>
                    : <i style={{ color: 'var(--color-text-light)' }}>alleen via website</i>}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Omschrijving</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Zichtbaar in de catalogus" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Icoon</label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="⚙️" style={fieldStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 12, background: 'var(--color-surface-2)', borderRadius: 8, border: '1px dashed var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Notatie:</span>
            <code style={{ fontSize: 13, flex: 1 }}>{notationPreview(form)}</code>
          </div>

          <label style={{ ...labelStyle, marginBottom: 8 }}>Stappen</label>
          <CommandStepsEditor
            steps={form.steps}
            actions={actions}
            onSetStep={setStep}
            onAddStep={addStep}
            onRemoveStep={removeStep}
            onMoveStep={moveStep}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(null)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>Annuleren</button>
            <button onClick={save} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>Opslaan</button>
          </div>
        </div>
      )}

      {!commands.length && !editing && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen commandos aangemaakt.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {commands.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-surface-2)', padding: '4px 10px', borderRadius: 6 }}>
              {c.icon} {c.notation_template}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flex: 1 }}>{c.description}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-light)' }}>{c.steps.length} stap{c.steps.length === 1 ? '' : 'pen'}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => duplicate(c)} title="Dupliceren als basis voor een nieuw commando" style={iconBtnStyle}>⎘</button>
              <button onClick={() => openEdit(c)} title="Bewerken" style={iconBtnStyle}>✎</button>
              <button onClick={() => remove(c)} title="Verwijderen" style={{ ...iconBtnStyle, color: 'var(--color-danger)' }}>✕</button>
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </div>
  )
}
