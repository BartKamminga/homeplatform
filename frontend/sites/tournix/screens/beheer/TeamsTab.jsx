import { useState, useEffect } from 'react'
import { getTeams, createTeam, updateTeam, deleteTeam } from '../../api.js'
import { card, ghostBtn, inputStyle, errorBanner } from '../styles.js'

export default function TeamsTab({ tournament, isAdmin }) {
  const [teams,     setTeams]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [newName,   setNewName]   = useState('')
  const [adding,    setAdding]    = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [editName,  setEditName]  = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [err,       setErr]       = useState('')

  useEffect(() => { load() }, [tournament.id])

  async function load() {
    setLoading(true)
    try { setTeams(await getTeams(tournament.id)) }
    catch { setErr('Laden mislukt') }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      const t = await createTeam(tournament.id, { name })
      setTeams(prev => [...prev, t])
      setNewName('')
    } catch { setErr('Aanmaken mislukt') }
    finally { setAdding(false) }
  }

  async function handleRename(team) {
    const name = editName.trim()
    setEditId(null)
    if (!name || name === team.name) return
    try {
      const updated = await updateTeam(team.id, { name })
      setTeams(prev => prev.map(t => t.id === team.id ? { ...t, ...updated } : t))
    } catch { setErr('Opslaan mislukt') }
  }

  async function handleDelete(id) {
    setConfirmId(null)
    try { await deleteTeam(id); setTeams(prev => prev.filter(t => t.id !== id)) }
    catch { setErr('Verwijderen mislukt') }
  }

  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 20 }}>Laden…</div>

  return (
    <div>
      {err && <div style={{ ...errorBanner, marginBottom: 12 }} onClick={() => setErr('')}>{err}</div>}

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Teamnaam…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            style={{ ...ghostBtn, color: 'var(--color-primary)', borderColor: 'var(--color-primary)', opacity: adding || !newName.trim() ? 0.4 : 1 }}
          >
            {adding ? '…' : '+ Team'}
          </button>
        </div>
      )}

      {teams.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 28 }}>
          Nog geen teams aangemaakt.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {teams.map((team, i) => (
            <div key={team.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 8,
            }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 22, flexShrink: 0 }}>
                {i + 1}.
              </span>
              {isAdmin && editId === team.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(team)}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditId(null) }}
                  style={{ ...inputStyle, flex: 1, fontSize: 13, padding: '3px 8px' }}
                />
              ) : (
                <span
                  style={{ flex: 1, fontSize: 13, fontWeight: 500, cursor: isAdmin ? 'text' : 'default' }}
                  onClick={() => { if (isAdmin) { setEditId(team.id); setEditName(team.name) } }}
                >{team.name}</span>
              )}
              {team.club_name && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>{team.club_name}</span>
              )}
              {isAdmin && (
                confirmId === team.id ? (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setConfirmId(null)}
                      style={{ ...ghostBtn, fontSize: 11, padding: '2px 8px' }}>Nee</button>
                    <button onClick={() => handleDelete(team.id)}
                      style={{ ...ghostBtn, fontSize: 11, padding: '2px 8px', borderColor: '#dc2626', color: '#dc2626' }}>
                      Ja
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(team.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>
                    ✕
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-muted)' }}>
        {teams.length} team{teams.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
