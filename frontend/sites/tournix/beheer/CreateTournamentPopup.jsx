import { useState, useEffect } from 'react'
import { createTournament, getClubs } from '../api.js'
import { inputStyle, primaryBtn, ghostBtn } from './styles.js'

export default function CreateTournamentPopup({ onClose, onCreated }) {
  const [name,    setName]    = useState('')
  const [clubId,  setClubId]  = useState('')
  const [date,    setDate]    = useState('')
  const [clubs,   setClubs]   = useState([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { getClubs().then(setClubs).catch(() => {}) }, [])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      await createTournament({
        name: name.trim(),
        location_club_id: clubId || null,
        date: date || null,
      })
      onCreated()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Nieuw toernooi</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>×</button>
        </div>
        {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>{error}</p>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Naam *" style={inputStyle} required autoFocus />
          <select value={clubId} onChange={e => setClubId(e.target.value)} style={inputStyle}>
            <option value="">Locatie (club)…</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>
            ))}
          </select>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Annuleer</button>
            <button type="submit" disabled={saving} style={{ ...primaryBtn, flex: 1 }}>
              {saving ? 'Aanmaken…' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
