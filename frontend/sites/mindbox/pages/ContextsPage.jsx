import { useEffect, useState } from 'react'
import { listContexts, createContext, updateContext, deleteContext } from '../api.js'

const EMPTY = { name: '', content: '' }

// Bart, 2-09-2026: "sommige mails wil ik behandelen als een manager... =
// een bepaalde session.md-inhoud" - een context is herbruikbare persona-/
// instructietekst die je aan items koppelt.
export default function ContextsPage() {
  const [contexts, setContexts] = useState([])
  const [editing, setEditing] = useState(null) // null=gesloten, {}=nieuw, object=bewerken
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  function load() {
    listContexts().then(setContexts).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setForm(EMPTY)
    setEditing({})
  }

  function openEdit(context) {
    setForm({ name: context.name, content: context.content })
    setEditing(context)
  }

  async function save() {
    if (!form.name.trim() || !form.content.trim()) return
    if (editing?.id) {
      await updateContext(editing.id, form)
    } else {
      await createContext(form)
    }
    setEditing(null)
    load()
  }

  async function remove(context) {
    if (!window.confirm(`Context "${context.name}" verwijderen? Cases die 'm gebruiken verliezen de koppeling.`)) return
    await deleteContext(context.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={openNew}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: '#fff' }}
        >
          + Nieuwe context
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Herbruikbare persona/instructie, bv. "Manager-response" of "Technische review"
        </span>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {editing && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Naam (bv. Manager-response)"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Instructie-/persona-tekst..."
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

      {!contexts.length && !editing && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen contexts aangemaakt.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {contexts.map(c => (
          <div key={c.id} style={{ padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>{c.name}</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(c)} title="Bewerken" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>✎</button>
                <button onClick={() => remove(c)} title="Verwijderen" style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
              {c.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
