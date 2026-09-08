import { useEffect, useState } from 'react'
import { listDeadlines, createDeadline, updateDeadline, deleteDeadline, listCases } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

const EMPTY = { date: '', title: '', description: '', case_id: '' }

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Item 1117 (Bart): "we hebben geen agenda, een kalender-view is dan wel
// handig" - BEWUST geen automatische datum-extractie uit vrije tekst, alleen
// een chronologische lijst van datums die de agent tijdens een sessie
// voorstelt en Bart bevestigt (zelfde filosofie als case-voorstellen in de
// Briefing-synthese, item 1115). Geen kalender-grid - te weinig items om dat
// te rechtvaardigen.
export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState([])
  const [cases,     setCases]     = useState([])
  const [editing,   setEditing]   = useState(null) // null=gesloten, {}=nieuw, object=bewerken
  const [form,      setForm]      = useState(EMPTY)
  const [error,     setError]     = useState('')
  const [confirmAction, confirmDialog] = useConfirm()

  function load() {
    listDeadlines().then(setDeadlines).catch(e => setError(e.message))
    listCases().then(setCases).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const caseName = caseId => cases.find(c => c.id === caseId)?.name

  function openNew() {
    setForm({ ...EMPTY, date: todayIso() })
    setEditing({})
  }

  function openEdit(d) {
    setForm({ date: d.date, title: d.title, description: d.description || '', case_id: d.case_id || '' })
    setEditing(d)
  }

  async function save() {
    // Bart, 8-9-2026: "opslaan agenda item werkt niet" - de guard hieronder
    // gaf bij een leeg/ongeldig veld stil niets terug (geen foutmelding), en
    // een mislukte API-call werd nergens opgevangen - dus "niks gebeurt er"
    // was letterlijk het enige zichtbare gedrag. Nu altijd een duidelijke
    // melding bij zowel validatie als een API-fout.
    if (!form.date || !form.title.trim()) {
      setError('Datum en titel zijn verplicht.')
      return
    }
    setError('')
    const body = {
      date: form.date,
      title: form.title,
      description: form.description || null,
      case_id: form.case_id || null,
    }
    try {
      if (editing?.id) {
        await updateDeadline(editing.id, { ...body, clear_case: !form.case_id })
      } else {
        await createDeadline(body)
      }
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message || 'Opslaan mislukt')
    }
  }

  async function remove(d) {
    if (!(await confirmAction(`Deadline "${d.title}" (${d.date}) verwijderen?`))) return
    try {
      await deleteDeadline(d.id)
      load()
    } catch (e) {
      setError(e.message || 'Verwijderen mislukt')
    }
  }

  const today = todayIso()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={openNew}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: '#fff' }}
        >
          + Nieuwe datum
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Belangrijke datums/deadlines, chronologisch - geen automatische extractie
        </span>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {editing && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)' }}
              />
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titel (bv. Go/no-go inhuur extra capaciteit)"
                style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)' }}
              />
            </div>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Omschrijving (optioneel)..."
              style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <select
              value={form.case_id}
              onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)' }}
            >
              <option value="">(geen case gekoppeld)</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={save} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {!deadlines.length && !editing && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen belangrijke datums vastgelegd.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deadlines.map(d => {
          const past = d.date < today
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8,
              opacity: past ? 0.55 : 1,
            }}>
              <div style={{ minWidth: 150, fontSize: 12, color: 'var(--color-text-muted)', paddingTop: 2 }}>
                {formatDate(d.date)}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{d.title}</strong>
                {d.case_id && (
                  <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {caseName(d.case_id) || d.case_id.slice(0, 8)}
                  </span>
                )}
                {d.description && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {d.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(d)} title="Bewerken" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>✎</button>
                <button onClick={() => remove(d)} title="Verwijderen" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
      {confirmDialog}
    </div>
  )
}
