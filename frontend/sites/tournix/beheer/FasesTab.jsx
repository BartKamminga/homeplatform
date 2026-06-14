import { useState, useEffect } from 'react'
import {
  getPhases, createPhase, updatePhase, deletePhase,
  setPhaseTeams, phaseTeamsFromStandings, generatePhaseSchedule,
  createPoolInPhase, deletePoolInPhase, autoPoolsInPhase,
  assignTeamPool, getTeams,
} from '../api.js'
import { inputStyle, primaryBtn, ghostBtn, noTid } from './styles.js'

export default function FasesTab({ tid, stage }) {
  const [phases,   setPhases]   = useState([])
  const [teams,    setTeams]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')
  const [error,    setError]    = useState('')
  const [newName,  setNewName]  = useState('')
  const [newType,  setNewType]  = useState('pool')
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { if (tid) load() }, [tid])

  async function load() {
    setLoading(true)
    try {
      const [p, t] = await Promise.all([getPhases(tid), getTeams(tid)])
      setPhases(p)
      setTeams(t)
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

  async function handleAddPhase(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createPhase(tid, { name: newName.trim(), order: phases.length, phase_type: newType })
      setNewName('')
      flash('Fase aangemaakt')
      await load()
    } catch (e) { flash(e.message, true) }
  }

  async function handleRename(pid, name) {
    try {
      await updatePhase(pid, { name })
      setEditId(null)
      await load()
    } catch (e) { flash(e.message, true) }
  }

  async function handleDelete(pid, name) {
    if (!window.confirm(`Fase "${name}" verwijderen? Alle wedstrijden in deze fase worden ook verwijderd.`)) return
    try {
      await deletePhase(pid)
      flash('Fase verwijderd')
      await load()
    } catch (e) { flash(e.message, true) }
  }

  async function handleGenerateSchedule(pid) {
    try {
      const r = await generatePhaseSchedule(pid)
      flash(`${r.created} wedstrijden aangemaakt`)
      await load()
    } catch (e) { flash(e.message, true) }
  }

  if (!tid) return <p style={noTid}>Selecteer een toernooi via de keuzelijst bovenaan.</p>
  if (loading) return <p style={muted}>Laden…</p>

  const isReadonly = stage !== 'inregel'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg   && <div style={successBanner}>{msg}</div>}
      {error && <div style={errorBanner}>{error}</div>}

      {phases.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen fases. Voeg hieronder een fase toe.
        </div>
      ) : phases.map(phase => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          teams={teams}
          isReadonly={isReadonly}
          editId={editId}
          editName={editName}
          setEditId={setEditId}
          setEditName={setEditName}
          onRename={handleRename}
          onDelete={handleDelete}
          onGenerateSchedule={handleGenerateSchedule}
          flash={flash}
          onRefresh={load}
        />
      ))}

      {!isReadonly && (
        <div style={card}>
          <div style={cardLabel}>NIEUWE FASE</div>
          <form onSubmit={handleAddPhase} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Naam van de fase"
              style={{ ...inputStyle, flex: 1, minWidth: 160 }}
            />
            <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="pool">Round-robin (poule)</option>
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

// ── Sub-component: één fase ───────────────────────────────────────────────────

function PhaseCard({
  phase, teams, isReadonly,
  editId, editName, setEditId, setEditName,
  onRename, onDelete, onGenerateSchedule,
  flash, onRefresh,
}) {
  const [numPools,    setNumPools]    = useState(2)
  const [newPoolName, setNewPoolName] = useState('')
  const [addingPool,  setAddingPool]  = useState(false)

  // Teams die in deze fase zitten
  const phaseTeamIds = new Set(
    phase.is_main_phase
      ? teams.map(t => t.id)
      : phase.teams.map(t => t.team_id)
  )
  const phaseTeams = teams.filter(t => phaseTeamIds.has(t.id))

  // Sub-pools: phase.pools
  const poolMap = Object.fromEntries((phase.pools ?? []).map(p => [p.id, p]))
  const teamsByPool = {}
  for (const p of (phase.pools ?? [])) teamsByPool[p.id] = []
  const unassigned = []
  for (const t of phaseTeams) {
    if (t.pool_id && teamsByPool[t.pool_id] !== undefined) teamsByPool[t.pool_id].push(t)
    else unassigned.push(t)
  }

  async function handleFromStandings() {
    const posInput = prompt('Posities (bijv. "1,2" voor top 2 uit elke poule):')
    if (!posInput) return
    const positions = posInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    if (!positions.length) return
    try {
      const r = await phaseTeamsFromStandings(phase.id, positions)
      flash(`${r.added} teams ingevuld vanuit standen`)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleToggleTeam(teamId) {
    const current = phase.teams ?? []
    const already = current.some(t => t.team_id === teamId)
    const next = already
      ? current.filter(t => t.team_id !== teamId)
      : [...current, { team_id: teamId, group_name: null }]
    try {
      await setPhaseTeams(phase.id, next)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleAutoPool() {
    try {
      const r = await autoPoolsInPhase(phase.id, { num_pools: numPools })
      flash(`${r.pools} poules aangemaakt, ${r.assigned} teams verdeeld`)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleAddPool(e) {
    e.preventDefault()
    if (!newPoolName.trim()) return
    try {
      await createPoolInPhase(phase.id, { name: newPoolName.trim(), order: (phase.pools ?? []).length })
      setNewPoolName('')
      setAddingPool(false)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleDeletePool(poolId, poolName) {
    if (!window.confirm(`Poule "${poolName}" verwijderen?`)) return
    try {
      await deletePoolInPhase(phase.id, poolId)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleAssignTeamPool(teamId, poolId) {
    try {
      await assignTeamPool(teamId, poolId || null)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  const typeBadge = phase.phase_type === 'ko' ? 'knock-out' : 'round-robin'
  const hasPools  = (phase.pools ?? []).length > 0

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {editId === phase.id ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={() => onRename(phase.id, editName)}
            onKeyDown={e => {
              if (e.key === 'Enter') onRename(phase.id, editName)
              if (e.key === 'Escape') setEditId(null)
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
        ) : (
          <span
            style={{ fontWeight: 700, fontSize: 15, flex: 1, cursor: isReadonly ? 'default' : 'pointer' }}
            onClick={() => { if (!isReadonly) { setEditId(phase.id); setEditName(phase.name) } }}
            title={isReadonly ? undefined : 'Klik om naam te bewerken'}
          >
            {phase.name}
          </span>
        )}
        <span style={typePill}>{typeBadge}</span>
        {phase.is_main_phase && <span style={mainPill}>hoofd</span>}
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {phase.match_count} wedstrijden
        </span>
        {!isReadonly && (
          <button onClick={() => onDelete(phase.id, phase.name)} style={deleteBtn}>✕</button>
        )}
      </div>

      {/* Pool-type: sub-pools + team-indeling */}
      {phase.phase_type === 'pool' && (
        <>
          {/* Sub-poule kaarten */}
          {hasPools && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {(phase.pools ?? []).map(pool => {
                const poolTeams = teamsByPool[pool.id] ?? []
                return (
                  <div key={pool.id} style={poolCard}>
                    <div style={poolHeader}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{pool.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 8 }}>{poolTeams.length} teams</span>
                      {!isReadonly && (
                        <button onClick={() => handleDeletePool(pool.id, pool.name)} style={smallDeleteBtn}>✕</button>
                      )}
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                      {poolTeams.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen teams</div>
                      ) : poolTeams.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          {t.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: 13 }}>{t.name}</span>
                          {!isReadonly && (
                            <select
                              value={t.pool_id || ''}
                              onChange={e => handleAssignTeamPool(t.id, e.target.value)}
                              style={teamPoolSelect}
                            >
                              <option value="">— geen —</option>
                              {(phase.pools ?? []).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Niet-ingedeelde teams */}
          {unassigned.length > 0 && hasPools && (
            <div style={{ padding: '8px 12px', border: '1px dashed var(--color-border)', borderRadius: 8, marginBottom: 12 }}>
              <div style={sectionLabel}>ZONDER POULE ({unassigned.length})</div>
              {unassigned.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {t.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
                  <span style={{ flex: 1, fontSize: 13 }}>{t.name}</span>
                  {!isReadonly && (
                    <select value="" onChange={e => handleAssignTeamPool(t.id, e.target.value)} style={teamPoolSelect}>
                      <option value="">Wijs toe…</option>
                      {(phase.pools ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Geen pools maar wel teams: toon teams overzicht */}
          {!hasPools && phaseTeams.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>TEAMS ({phaseTeams.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {phaseTeams.map(t => (
                  <span key={t.id} style={teamChip}>{t.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Voor niet-hoofd fases: team-selectie toggle */}
          {!phase.is_main_phase && !isReadonly && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>DEELNEMENDE TEAMS</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {teams.map(t => {
                  const inPhase = phaseTeamIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleToggleTeam(t.id)}
                      style={{
                        padding: '3px 10px', fontSize: 12, borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${inPhase ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: inPhase ? 'var(--color-primary)' : 'transparent',
                        color: inPhase ? '#fff' : 'var(--color-text-muted)',
                      }}
                    >{t.name}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Acties: auto-verdelen + poule toevoegen + schema */}
          {!isReadonly && (
            <div style={actionRow}>
              {/* Auto-verdelen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  value={numPools}
                  onChange={e => setNumPools(Number(e.target.value))}
                  style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 12 }}
                >
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} poules</option>)}
                </select>
                <button onClick={handleAutoPool} style={{ ...primaryBtn, fontSize: 12 }}>⚡ Auto-verdelen</button>
              </div>

              {/* Poule toevoegen */}
              {addingPool ? (
                <form onSubmit={handleAddPool} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={newPoolName}
                    onChange={e => setNewPoolName(e.target.value)}
                    placeholder="Poulnaam"
                    style={{ ...inputStyle, width: 120, fontSize: 12 }}
                  />
                  <button type="submit" style={{ ...ghostBtn, fontSize: 12 }}>+</button>
                  <button type="button" onClick={() => { setAddingPool(false); setNewPoolName('') }}
                    style={{ ...ghostBtn, fontSize: 12 }}>✕</button>
                </form>
              ) : (
                <button onClick={() => setAddingPool(true)} style={{ ...ghostBtn, fontSize: 12 }}>+ Poule</button>
              )}

              <button onClick={() => onGenerateSchedule(phase.id)} style={{ ...primaryBtn, fontSize: 12 }}>
                Genereer schema
              </button>
              {!phase.is_main_phase && (
                <button onClick={handleFromStandings} style={{ ...ghostBtn, fontSize: 12 }}>
                  Vul uit standen
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* KO-type: team-toggles */}
      {phase.phase_type === 'ko' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={sectionLabel}>DEELNEMENDE TEAMS</div>
            {!phase.is_main_phase ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {teams.map(t => {
                  const inPhase = phaseTeamIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => !isReadonly && handleToggleTeam(t.id)}
                      disabled={isReadonly}
                      style={{
                        padding: '3px 10px', fontSize: 12, borderRadius: 99,
                        cursor: isReadonly ? 'default' : 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${inPhase ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: inPhase ? 'var(--color-primary)' : 'transparent',
                        color: inPhase ? '#fff' : 'var(--color-text-muted)',
                      }}
                    >{t.name}</button>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Alle toernooiteams doen mee.</div>
            )}
          </div>

          {!isReadonly && (
            <div style={actionRow}>
              <button onClick={() => onGenerateSchedule(phase.id)} style={{ ...primaryBtn, fontSize: 12 }}>
                Genereer schema
              </button>
              {!phase.is_main_phase && (
                <button onClick={handleFromStandings} style={{ ...ghostBtn, fontSize: 12 }}>
                  Vul uit standen
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Waarschuwing: teams maar geen schema */}
      {(hasPools || phaseTeams.length > 0) && phase.match_count === 0 && !isReadonly && (
        <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 8 }}>
          Teams zijn toegewezen maar er is nog geen schema gegenereerd.
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card          = { padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 10 }
const cardLabel     = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase' }
const muted         = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const successBanner = { padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', color: 'var(--color-success)', fontSize: 13, fontWeight: 500 }
const errorBanner   = { padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-danger) 15%, var(--color-surface))', color: 'var(--color-danger)', fontSize: 13, fontWeight: 500 }
const typePill      = { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
const mainPill      = { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--color-primary)', color: '#fff' }
const deleteBtn     = { padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }
const smallDeleteBtn = { marginLeft: 'auto', padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }
const poolCard      = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }
const poolHeader    = { display: 'flex', alignItems: 'center', padding: '7px 12px', background: 'var(--color-primary)', color: '#fff' }
const teamPoolSelect = { fontSize: 11, padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-background)', color: 'var(--color-text)', cursor: 'pointer' }
const sectionLabel  = { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }
const teamChip      = { padding: '3px 10px', fontSize: 12, borderRadius: 99, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
const actionRow     = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }
