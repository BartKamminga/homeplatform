import { useState, useEffect } from 'react'
import {
  getPhases, createPhase, updatePhase, deletePhase,
  setPhaseTeams, phaseTeamsFromStandings, generatePhaseSchedule,
  getStandings, getTeams,
} from '../api.js'
import { inputStyle, primaryBtn, ghostBtn, noTid } from './styles.js'

const TEMPLATES = [
  { label: 'Kampioensbracket (top 2)',   name: 'Kampioensbracket',    positions: [1, 2], type: 'pool' },
  { label: 'Consolatiebracket (3e-4e)',  name: 'Consolatiebracket',   positions: [3, 4], type: 'pool' },
  { label: 'Plaatsingswedstrijden (5e-6e)', name: 'Plaatsingswedstrijden', positions: [5, 6], type: 'pool' },
]

export default function FasesTab({ tid, stage }) {
  const [phases,   setPhases]   = useState([])
  const [teams,    setTeams]    = useState([])
  const [standings, setStandings] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')
  const [error,    setError]    = useState('')

  const [newName,  setNewName]  = useState('')
  const [newType,  setNewType]  = useState('pool')
  const [adding,   setAdding]   = useState(false)

  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (!tid) return
    load()
  }, [tid])

  async function load() {
    setLoading(true)
    try {
      const [p, t, s] = await Promise.all([
        getPhases(tid),
        getTeams(tid),
        getStandings(tid).catch(() => []),
      ])
      setPhases(p)
      setTeams(t)
      setStandings(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function flash(text, isErr = false) {
    if (isErr) setError(text)
    else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 3000)
  }

  async function handleCreateFromTemplate(tpl) {
    try {
      const phase = await createPhase(tid, { name: tpl.name, order: phases.length, phase_type: tpl.type })
      await phaseTeamsFromStandings(phase.id, tpl.positions)
      flash(`${tpl.name} aangemaakt`)
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createPhase(tid, { name: newName.trim(), order: phases.length, phase_type: newType })
      setNewName('')
      flash('Fase aangemaakt')
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  async function handleRename(pid, name) {
    try {
      await updatePhase(pid, { name })
      setEditId(null)
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  async function handleDelete(pid, name) {
    if (!window.confirm(`Fase "${name}" verwijderen? Alle wedstrijden in deze fase worden ook verwijderd.`)) return
    try {
      await deletePhase(pid)
      flash('Fase verwijderd')
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  async function handleAssignTemplate(pid, positions) {
    try {
      const r = await phaseTeamsFromStandings(pid, positions)
      flash(`${r.added} teams toegewezen`)
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  async function handleGenerateSchedule(pid) {
    try {
      const r = await generatePhaseSchedule(pid)
      flash(`${r.created} wedstrijden aangemaakt`)
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  async function handleToggleTeam(pid, teamId, currentTeams) {
    const already = currentTeams.some(t => t.team_id === teamId)
    const next = already
      ? currentTeams.filter(t => t.team_id !== teamId)
      : [...currentTeams, { team_id: teamId, group_name: null }]
    try {
      await setPhaseTeams(pid, next)
      await load()
    } catch (e) {
      flash(e.message, true)
    }
  }

  if (!tid) return <p style={noTid}>Selecteer een toernooi via de keuzelijst bovenaan.</p>
  if (loading) return <p style={muted}>Laden…</p>

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
  const isReadonly = stage !== 'inregel'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {msg   && <div style={successBanner}>{msg}</div>}
      {error && <div style={errorBanner}>{error}</div>}

      {/* Templates — snelle aanmaak */}
      {!isReadonly && (
        <div style={card}>
          <div style={cardLabel}>TEMPLATES</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {TEMPLATES.map(tpl => (
              <button key={tpl.name} onClick={() => handleCreateFromTemplate(tpl)}
                style={{ ...ghostBtn, fontSize: 12 }}>
                + {tpl.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Teams worden automatisch ingevuld op basis van de huidige poule-standen.
          </div>
        </div>
      )}

      {/* Bestaande fases */}
      {phases.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen fases aangemaakt.{isReadonly ? '' : ' Gebruik een template of voeg handmatig toe.'}
        </div>
      ) : phases.map(phase => {
        const phaseTeamIds = new Set(phase.teams.map(t => t.team_id))

        return (
          <div key={phase.id} style={card}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {editId === phase.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(phase.id, editName)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(phase.id, editName); if (e.key === 'Escape') setEditId(null) }}
                  style={{ ...inputStyle, flex: 1 }}
                />
              ) : (
                <span
                  style={{ fontWeight: 600, fontSize: 14, flex: 1, cursor: isReadonly ? 'default' : 'pointer' }}
                  onClick={() => { if (!isReadonly) { setEditId(phase.id); setEditName(phase.name) } }}
                  title={isReadonly ? undefined : 'Klik om naam te bewerken'}
                >
                  {phase.name}
                </span>
              )}
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                {phase.phase_type === 'ko' ? 'knock-out' : 'round-robin'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {phase.teams.length} teams · {phase.match_count} wedstrijden
              </span>
              {!isReadonly && (
                <button onClick={() => handleDelete(phase.id, phase.name)}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Teams */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Teams</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {teams.map(t => {
                  const inPhase = phaseTeamIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => !isReadonly && handleToggleTeam(phase.id, t.id, phase.teams)}
                      disabled={isReadonly}
                      style={{
                        padding: '4px 10px', fontSize: 12, borderRadius: 99, cursor: isReadonly ? 'default' : 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${inPhase ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: inPhase ? 'var(--color-primary)' : 'transparent',
                        color: inPhase ? '#fff' : 'var(--color-text-muted)',
                        fontWeight: inPhase ? 600 : 400,
                      }}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Acties */}
            {!isReadonly && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                <button onClick={() => handleGenerateSchedule(phase.id)} style={{ ...primaryBtn, fontSize: 12 }}>
                  Genereer schema
                </button>
                {TEMPLATES.map(tpl => (
                  <button key={tpl.name} onClick={() => handleAssignTemplate(phase.id, tpl.positions)}
                    style={{ ...ghostBtn, fontSize: 11 }}>
                    Vul: {tpl.label}
                  </button>
                ))}
              </div>
            )}

            {/* Waarschuwing: teams maar geen schema */}
            {phase.teams.length > 0 && phase.match_count === 0 && !isReadonly && (
              <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 8 }}>
                Teams zijn toegewezen maar er is nog geen schema gegenereerd.
              </div>
            )}
          </div>
        )
      })}

      {/* Handmatig toevoegen */}
      {!isReadonly && (
        <div style={card}>
          <div style={cardLabel}>NIEUWE FASE</div>
          <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Naam van de fase"
              style={{ ...inputStyle, flex: 1, minWidth: 160 }}
            />
            <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="pool">Round-robin</option>
              <option value="ko">Knock-out</option>
            </select>
            <button type="submit" disabled={!newName.trim()} style={{ ...primaryBtn, opacity: newName.trim() ? 1 : 0.5 }}>
              Voeg toe
            </button>
          </form>
        </div>
      )}

    </div>
  )
}

const card        = { padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }
const cardLabel   = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase' }
const muted       = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const successBanner = { padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', color: 'var(--color-success)', fontSize: 13, fontWeight: 500 }
const errorBanner   = { padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-danger) 15%, var(--color-surface))', color: 'var(--color-danger)', fontSize: 13, fontWeight: 500 }
