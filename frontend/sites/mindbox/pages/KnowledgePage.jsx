import { useEffect, useState } from 'react'
import { listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

const EMPTY = { name: '', content: '' }

// Bart, 2-09-2026: generieke, cross-case kennis-/reference-info (bv.
// "NIPV-Info", "Hoe sla ik plaatjes op") - los van Context (dat gaat over
// HOE Bart moet reageren) en Contact (dat gaat over WIE de andere partij
// is). v1 is een losstaande bibliotheek: geen koppeling aan cases.
export default function KnowledgePage() {
  const [entries, setEntries] = useState([])
  const [editing, setEditing] = useState(null) // null=gesloten, {}=nieuw, object=bewerken
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [confirmAction, confirmDialog] = useConfirm()

  function load() {
    listKnowledge().then(setEntries).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setForm(EMPTY)
    setEditing({})
  }

  function openEdit(entry) {
    setForm({ name: entry.name, content: entry.content })
    setEditing(entry)
  }

  async function save() {
    if (!form.name.trim() || !form.content.trim()) return
    if (editing?.id) {
      await updateKnowledge(editing.id, form)
    } else {
      await createKnowledge(form)
    }
    setEditing(null)
    load()
  }

  async function remove(entry) {
    if (!(await confirmAction(`Kennis-item "${entry.name}" verwijderen?`))) return
    await deleteKnowledge(entry.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={openNew}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: '#fff' }}
        >
          + Nieuw kennis-item
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Generieke reference-info, bv. "NIPV-Info" of "Hoe sla ik plaatjes op"
        </span>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {editing && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Naam (bv. NIPV-Info)"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Inhoud..."
              style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 160, fontFamily: 'inherit', resize: 'vertical' }}
            />
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

      {!entries.length && !editing && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen kennis-items aangemaakt.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {entries.map(k => (
          <div key={k.id} style={{ padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>{k.name}</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(k)} title="Bewerken" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>✎</button>
                <button onClick={() => remove(k)} title="Verwijderen" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
              {k.content}
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </div>
  )
}
