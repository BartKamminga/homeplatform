import { useState } from 'react'
import { createClub, updateClub, deleteClub } from '../api.js'
import { inputStyle, primaryBtn, ghostBtn } from './styles.js'

export default function ClubsTab({ clubs, onRefresh }) {
  const [editId,   setEditId]   = useState(null)
  const [editData, setEditData] = useState({})
  const [newName,  setNewName]  = useState('')
  const [newAbbr,  setNewAbbr]  = useState('')
  const [newCity,  setNewCity]  = useState('')
  const [newColor, setNewColor] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  function startEdit(c) {
    setEditId(c.id)
    setEditData({ name: c.name, abbreviation: c.abbreviation ?? '', city: c.city ?? '', color: c.color ?? '' })
  }

  async function saveEdit(id) {
    try {
      await updateClub(id, {
        name: editData.name?.trim() || undefined,
        abbreviation: editData.abbreviation || null,
        city: editData.city || null,
        color: editData.color || null,
      })
      setEditId(null)
      await onRefresh()
    } catch (err) { alert(err.message ?? 'Fout bij opslaan') }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Club "${name}" verwijderen?`)) return
    await deleteClub(id)
    await onRefresh()
  }

  async function submitNew(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true); setError('')
    try {
      await createClub({ name: newName.trim(), abbreviation: newAbbr || null, city: newCity || null, color: newColor || null })
      setNewName(''); setNewAbbr(''); setNewCity(''); setNewColor('')
      await onRefresh()
    } catch (err) { setError(err.message ?? 'Fout bij aanmaken') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        Stamtabel — {clubs.length} clubs
      </div>

      {clubs.map(c => (
        <div key={c.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px' }}>
          {editId === c.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={editData.name}
                  onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                  placeholder="Naam *" style={{ ...inputStyle, flex: 2, minWidth: 100 }} autoFocus />
                <input
                  value={editData.abbreviation}
                  onChange={e => setEditData(d => ({ ...d, abbreviation: e.target.value }))}
                  placeholder="Afk." style={{ ...inputStyle, width: 56 }} maxLength={5} />
                <input
                  value={editData.city}
                  onChange={e => setEditData(d => ({ ...d, city: e.target.value }))}
                  placeholder="Stad" style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
                <input type="color"
                  value={editData.color || '#888888'}
                  onChange={e => setEditData(d => ({ ...d, color: e.target.value }))}
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveEdit(c.id)} style={{ ...primaryBtn, padding: '6px 14px', fontSize: 12 }}>Opslaan</button>
                <button onClick={() => setEditId(null)} style={ghostBtn}>Annuleer</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {c.color && <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, flexShrink: 0 }} />}
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{c.name}</span>
              {c.abbreviation && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 30 }}>{c.abbreviation}</span>}
              {c.city && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.city}</span>}
              <button onClick={() => startEdit(c)}
                style={{ ...ghostBtn, padding: '4px 10px', fontSize: 11 }}>Wijzig</button>
              <button onClick={() => handleDelete(c.id, c.name)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}
        </div>
      ))}

      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>}

      <form onSubmit={submitNew} style={{ display: 'flex', gap: 8, flexWrap: 'wrap',
        borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Naam *"
          style={{ ...inputStyle, flex: 2, minWidth: 100 }} required />
        <input value={newAbbr} onChange={e => setNewAbbr(e.target.value)} placeholder="Afk."
          style={{ ...inputStyle, width: 56 }} maxLength={5} />
        <input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Stad"
          style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
        <input type="color" value={newColor || '#888888'} onChange={e => setNewColor(e.target.value)}
          style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }} />
        <button type="submit" disabled={saving} style={primaryBtn}>{saving ? '…' : '+ Club'}</button>
      </form>
    </div>
  )
}
