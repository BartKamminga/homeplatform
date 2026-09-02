import { useEffect, useState } from 'react'
import { listResponses, createResponse, listItems } from '../api.js'

function fmtDate(iso) {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Fase 1: de INHOUD van een response wordt hier door Bart/Claude samen
// ingevuld (bv. na een Claude Code-sessie), niet automatisch gegenereerd -
// zie plan item 1050.
export default function ResponsesPage() {
  const [responses, setResponses] = useState([])
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ content: '', source_item_ids: [], parent_response_id: '' })
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')

  function load() {
    listResponses().then(setResponses).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    listItems().then(setItems).catch(() => {})
  }, [])

  function itemLabel(id) {
    return items.find(i => i.id === id)?.original_filename || id
  }

  function toggleSource(id) {
    setForm(f => ({
      ...f,
      source_item_ids: f.source_item_ids.includes(id)
        ? f.source_item_ids.filter(x => x !== id)
        : [...f.source_item_ids, id],
    }))
  }

  async function save() {
    if (!form.content.trim()) return
    await createResponse({
      content: form.content,
      source_item_ids: form.source_item_ids,
      parent_response_id: form.parent_response_id || null,
    })
    setForm({ content: '', source_item_ids: [], parent_response_id: '' })
    setShowNew(false)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setShowNew(s => !s)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: '#fff' }}
        >
          + Nieuwe response
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Concept-antwoord/rapport, met bronvermelding en optioneel opvolging op een eerdere response
        </span>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {showNew && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Inhoud van de response..."
              style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', minHeight: 160, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>BRONNEN</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(i => (
                  <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 99, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.source_item_ids.includes(i.id)} onChange={() => toggleSource(i.id)} />
                    {i.original_filename}
                  </label>
                ))}
              </div>
            </div>
            <select
              value={form.parent_response_id}
              onChange={e => setForm(f => ({ ...f, parent_response_id: e.target.value }))}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            >
              <option value="">Geen opvolging (nieuwe response)</option>
              {responses.map(r => (
                <option key={r.id} value={r.id}>Opvolging op: {r.content.slice(0, 60)}...</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={save} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {!responses.length && !showNew && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nog geen responses.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {responses.map(r => (
          <div key={r.id} style={{ padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.content}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>{fmtDate(r.created_at)}</span>
              {r.source_item_ids.map(id => (
                <span key={id} style={{ padding: '1px 6px', border: '1px solid var(--color-border)', borderRadius: 99 }}>📎 {itemLabel(id)}</span>
              ))}
              {r.parent_response_id && <span style={{ fontStyle: 'italic' }}>↳ vervolg op een eerdere response</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
