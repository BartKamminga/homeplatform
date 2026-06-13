import { useState, useEffect } from 'react'
import { getFields, createField, deleteField } from '../api.js'
import { inputStyle, primaryBtn, noTid } from './styles.js'

export default function FieldsTab({ tid, clubs, stage }) {
  const [fields, setFields] = useState([])
  const [name,   setName]   = useState('')
  const [clubId, setClubId] = useState('')
  const [saving, setSaving] = useState(false)
  const locked = stage !== 'inregel'
  const clubMap = Object.fromEntries((clubs ?? []).map(c => [c.id, c]))

  async function load() {
    if (!tid) return
    getFields(tid).then(setFields).catch(() => {})
  }

  useEffect(() => { load() }, [tid])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !tid) return
    setSaving(true)
    try {
      await createField(tid, { name: name.trim(), club_id: clubId || null })
      setName(''); setClubId('')
      await load()
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await deleteField(id)
    await load()
  }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {locked && (
        <div style={{ padding: '8px 14px', background: 'var(--color-warning)', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
          {stage === 'productie' ? 'Productie — velden zijn vergrendeld' : 'Test-modus — geen wijzigingen'}
        </div>
      )}

      {fields.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{f.name}</span>
          {f.club_id && clubMap[f.club_id] && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{clubMap[f.club_id].name}</span>
          )}
          {!locked && (
            <button onClick={() => handleDelete(f.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 18, lineHeight: 1 }}>×</button>
          )}
        </div>
      ))}

      {!locked && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Veldnaam *"
            style={{ ...inputStyle, flex: 1, minWidth: 120 }} required />
          {clubs && clubs.length > 0 && (
            <select value={clubId} onChange={e => setClubId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 120 }}>
              <option value="">Club…</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button type="submit" disabled={saving} style={primaryBtn}>{saving ? '…' : '+ Veld'}</button>
        </form>
      )}
    </div>
  )
}
