import { useState } from 'react'
import { createTeam, updateTeam, deleteTeam } from '../api.js'
import { inputStyle, primaryBtn, ghostBtn, noTid } from './styles.js'

export default function TeamsTab({ tid, pools, teams, clubs, stage, loadTeams }) {
  const [name,    setName]    = useState('')
  const [color,   setColor]   = useState('')
  const [clubId,  setClubId]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [editId,  setEditId]  = useState(null)
  const [editName,  setEditName]  = useState('')
  const [editClub,  setEditClub]  = useState('')
  const [editColor, setEditColor] = useState('')
  const locked = stage !== 'inregel'

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !tid) return
    setSaving(true)
    try {
      await createTeam(tid, { name: name.trim(), color: color || null, club_id: clubId || null })
      setName(''); setColor(''); setClubId('')
      await loadTeams()
    } catch (err) { alert(err.message ?? 'Fout bij aanmaken') }
    finally { setSaving(false) }
  }

  function startEdit(t) {
    setEditId(t.id)
    setEditName(t.name)
    setEditClub(t.club_id ?? '')
    setEditColor(t.color ?? '')
  }

  async function saveEdit(id) {
    try {
      await updateTeam(id, {
        name: editName.trim() || undefined,
        club_id: editClub || null,
        color: editColor || null,
      })
      setEditId(null)
      await loadTeams()
    } catch (err) { alert(err.message ?? 'Fout bij opslaan') }
  }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {locked && (
        <div style={{ padding: '8px 14px', background: 'var(--color-warning)', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
          {stage === 'productie' ? 'Productie — teams zijn vergrendeld' : 'Test-modus — geen wijzigingen'}
        </div>
      )}

      {teams.filter(t => !t.is_placeholder).map(t => (
        <div key={t.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px' }}>
          {editId === t.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 120 }} autoFocus
                  onKeyDown={e => { if (e.key === 'Escape') setEditId(null) }} />
                {clubs.length > 0 && (
                  <select value={editClub} onChange={e => setEditClub(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 120 }}>
                    <option value="">— geen club —</option>
                    {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <input type="color" value={editColor || '#888888'} onChange={e => setEditColor(e.target.value)}
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveEdit(t.id)} style={{ ...primaryBtn, padding: '6px 14px', fontSize: 12 }}>Opslaan</button>
                <button onClick={() => setEditId(null)} style={{ ...ghostBtn }}>Annuleer</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {t.color && <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.name}</span>
              {t.club_id && clubs.find(c => c.id === t.club_id) && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {clubs.find(c => c.id === t.club_id).name}
                </span>
              )}
              {pools.length > 0 && t.pool_id && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  background: 'var(--color-primary)', color: '#fff', fontWeight: 600 }}>
                  {pools.find(p => p.id === t.pool_id)?.name ?? ''}
                </span>
              )}
              {!locked && (
                <>
                  <button onClick={() => startEdit(t)}
                    style={{ ...ghostBtn, padding: '4px 10px', fontSize: 11 }}>Wijzig</button>
                  <button onClick={async () => { await deleteTeam(t.id); await loadTeams() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 18, lineHeight: 1 }}>×</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {!locked && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Teamnaam *"
            style={{ ...inputStyle, flex: 1, minWidth: 120 }} required />
          {clubs.length > 0 && (
            <select value={clubId} onChange={e => setClubId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 120 }}>
              <option value="">Club…</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input type="color" value={color || '#888888'} onChange={e => setColor(e.target.value)}
            style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }} />
          <button type="submit" disabled={saving} style={primaryBtn}>{saving ? '…' : '+ Team'}</button>
        </form>
      )}
    </div>
  )
}
