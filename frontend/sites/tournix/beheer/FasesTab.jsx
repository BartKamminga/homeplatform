import { useState, useEffect } from 'react'
import {
  getPhases, createPhase, updatePhase, deletePhase,
  createPoolInPhase, deletePoolInPhase, autoPoolsInPhase,
  preAllocatePhaseTeams, resolvePhaseplaceholders,
  assignTeamPool, getTeams, getFields,
  setPhaseFields,
} from '../api.js'
import { inputStyle, primaryBtn, ghostBtn, noTid } from './styles.js'

export default function FasesTab({ tid, stage }) {
  const [phases,   setPhases]   = useState([])
  const [teams,    setTeams]    = useState([])
  const [fields,   setFields]   = useState([])
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
      const [p, t, f] = await Promise.all([getPhases(tid), getTeams(tid), getFields(tid)])
      setPhases(p)
      setTeams(t)
      setFields(f)
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
          fields={fields}
          stage={stage}
          isReadonly={isReadonly}
          editId={editId}
          editName={editName}
          setEditId={setEditId}
          setEditName={setEditName}
          onRename={handleRename}
          onDelete={handleDelete}
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
  phase, teams, fields, stage, isReadonly,
  editId, editName, setEditId, setEditName,
  onRename, onDelete,
  flash, onRefresh,
}) {
  const [numPools,      setNumPools]      = useState(2)
  const [newPoolName,   setNewPoolName]   = useState('')
  const [addingPool,    setAddingPool]    = useState(false)
  const [perPool,       setPerPool]       = useState(2)
  const [duration,      setDuration]      = useState(phase.match_duration_min ?? 20)
  const [breakMin,      setBreakMin]      = useState(phase.break_min ?? 5)
  const [selectedFids,  setSelectedFids]  = useState(new Set(phase.field_ids ?? []))

  // Teams die in deze fase zitten (main = iedereen, anders: TournixPhaseTeam)
  const phaseTeamIds = new Set(
    phase.is_main_phase
      ? teams.map(t => t.id)
      : phase.teams.map(t => t.team_id)
  )
  const phaseTeamObjects = teams.filter(t => phaseTeamIds.has(t.id))
  const phasePlaceholders = phaseTeamObjects.filter(t => t.is_placeholder)
  const phaseRealTeams    = phaseTeamObjects.filter(t => !t.is_placeholder)
  const hasPlaceholders   = phasePlaceholders.length > 0
  const hasRealTeams      = phaseRealTeams.length > 0

  // Sub-pools: toon alle teamobjecten inclusief placeholders in poule-kaarten
  const teamsByPool = {}
  for (const p of (phase.pools ?? [])) teamsByPool[p.id] = []
  const unassigned = []
  for (const t of phaseTeamObjects) {
    if (t.pool_id && teamsByPool[t.pool_id] !== undefined) teamsByPool[t.pool_id].push(t)
    else unassigned.push(t)
  }

  async function handleSetKoType(value) {
    try {
      await updatePhase(phase.id, { ko_type: value })
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleSetPoolType(value) {
    try {
      await updatePhase(phase.id, { pool_type: value })
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleApplySlots() {
    const positions = Array.from({ length: perPool }, (_, i) => i + 1)
    try {
      const r = await preAllocatePhaseTeams(phase.id, positions)
      flash(`${r.created} slots aangemaakt vanuit "${r.source_phase}"`)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleResolveNow() {
    try {
      const r = await resolvePhaseplaceholders(phase.id)
      flash(`${r.resolved} teams opgelost`)
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

  async function handleSaveScheduleParams() {
    try {
      await updatePhase(phase.id, { match_duration_min: duration, break_min: breakMin })
      await setPhaseFields(phase.id, Array.from(selectedFids))
      flash('Inplanning instellingen opgeslagen')
    } catch (e) { flash(e.message, true) }
  }

  function toggleField(fid) {
    setSelectedFids(prev => {
      const next = new Set(prev)
      if (next.has(fid)) next.delete(fid)
      else next.add(fid)
      return next
    })
  }

  const typeBadge = phase.phase_type === 'ko' ? 'knock-out' : 'round-robin'
  const hasPools  = (phase.pools ?? []).length > 0

  // Inline doorgang-configuratie voor niet-hoofd fases
  const doorGangUI = !phase.is_main_phase && (
    <div style={doorGangBox}>
      {hasPlaceholders ? (
        <>
          <div style={sectionLabel}>GEPLANDE DOORGANG ({phasePlaceholders.length} slots)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {phasePlaceholders.map(t => <span key={t.id} style={slotChip}>{t.name}</span>)}
          </div>
          {!isReadonly && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Hermaak:</span>
              {[1,2,3,4].map(n => (
                <button key={n} onClick={() => setPerPool(n)} style={perPoolBtnStyle(n === perPool)}>{n}</button>
              ))}
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>per poule</span>
              <button onClick={handleApplySlots} style={{ ...ghostBtn, fontSize: 12 }}>↺ Hermaak</button>
            </div>
          )}
        </>
      ) : hasRealTeams ? (
        <>
          <div style={sectionLabel}>DOORGESTUURDE TEAMS ({phaseRealTeams.length})</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {phaseRealTeams.map(t => <span key={t.id} style={teamChip}>{t.name}</span>)}
          </div>
        </>
      ) : !isReadonly ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Doorgang uit vorige fase
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>de eerste</span>
            {[1,2,3,4].map(n => (
              <button key={n} onClick={() => setPerPool(n)} style={perPoolBtnStyle(n === perPool)}>{n}</button>
            ))}
            <span style={{ fontSize: 13 }}>per poule gaan door</span>
            <button onClick={handleApplySlots} style={{ ...primaryBtn, fontSize: 13 }}>Toepassen</button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen teams geconfigureerd.</div>
      )}
    </div>
  )

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

      {/* Pool-type fase */}
      {phase.phase_type === 'pool' && (
        <>
          {/* Doorgang-configuratie (alleen voor niet-hoofd fases) */}
          {doorGangUI}

          {/* Speelschema kiezen */}
          {!isReadonly && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>SPEELSCHEMA</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { value: 'half', label: 'Halve competitie' },
                  { value: 'vol',  label: 'Hele competitie'  },
                ].map(({ value, label }) => {
                  const isActive = (phase.pool_type ?? 'half') === value
                  return (
                    <button key={value} onClick={() => handleSetPoolType(value)}
                      style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, border: 'none', fontFamily: 'inherit', cursor: 'pointer', fontWeight: isActive ? 700 : 400,
                        background: isActive ? 'var(--color-primary)' : 'var(--color-surface-2)',
                        color: isActive ? '#fff' : 'var(--color-text-muted)' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-poule kaarten */}
          {hasPools && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
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
                          <span style={{ flex: 1, fontSize: 13, fontStyle: t.is_placeholder ? 'italic' : 'normal', opacity: t.is_placeholder ? 0.7 : 1 }}>{t.name}</span>
                          {!isReadonly && !t.is_placeholder && (
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

          {/* Niet-ingedeelde teams (alleen echte teams tonen) */}
          {unassigned.filter(t => !t.is_placeholder).length > 0 && hasPools && (
            <div style={{ padding: '8px 12px', border: '1px dashed var(--color-border)', borderRadius: 8, marginBottom: 12 }}>
              <div style={sectionLabel}>ZONDER POULE ({unassigned.filter(t => !t.is_placeholder).length})</div>
              {unassigned.filter(t => !t.is_placeholder).map(t => (
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

          {/* Geen pools: toon teams als chips (hoofd-fase) */}
          {!hasPools && phase.is_main_phase && phaseRealTeams.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>TEAMS ({phaseRealTeams.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {phaseRealTeams.map(t => (
                  <span key={t.id} style={teamChip}>{t.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Acties: auto-verdelen + poule toevoegen */}
          {!isReadonly && (
            <div style={actionRow}>
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
            </div>
          )}
        </>
      )}

      {/* KO-type fase */}
      {phase.phase_type === 'ko' && (
        <>
          {phase.is_main_phase ? (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>DEELNEMENDE TEAMS</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Alle toernooiteams doen mee.</div>
            </div>
          ) : (
            <>
              {doorGangUI}

              {/* KO-type kiezen */}
              {!isReadonly && (
                <div style={{ marginBottom: 12 }}>
                  <div style={sectionLabel}>KO-TYPE</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { value: 'single',      label: 'Enkelvoudig' },
                      { value: 'consolation', label: '+ Troostfinale' },
                      { value: 'double',      label: 'Dubbel', disabled: true },
                    ].map(({ value, label, disabled }) => {
                      const active = (phase.ko_type || 'single') === value
                      return (
                        <button
                          key={value}
                          onClick={() => !disabled && handleSetKoType(value)}
                          disabled={disabled}
                          style={{
                            padding: '4px 14px', fontSize: 12, borderRadius: 99,
                            cursor: disabled ? 'default' : 'pointer',
                            fontFamily: 'inherit', border: 'none',
                            background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: active ? '#fff' : disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
                            outline: active ? 'none' : '1px solid var(--color-border)',
                            opacity: disabled ? 0.45 : 1,
                          }}
                        >{label}</button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Inplannen */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        <div style={sectionLabel}>INPLANNEN</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>

          {/* Duur + pauze */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Duur</label>
            <input
              type="number" min="1" max="120" value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              disabled={isReadonly}
              style={{ ...inputStyle, width: 54, fontSize: 12, padding: '4px 6px' }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>min</span>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>Pauze</label>
            <input
              type="number" min="0" max="60" value={breakMin}
              onChange={e => setBreakMin(Number(e.target.value))}
              disabled={isReadonly}
              style={{ ...inputStyle, width: 44, fontSize: 12, padding: '4px 6px' }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>min</span>
          </div>

          {/* Velden */}
          {fields.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Velden:</span>
              {fields.map(f => {
                const active = selectedFids.has(f.id) || selectedFids.size === 0
                const checked = selectedFids.has(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={isReadonly}
                    onClick={() => toggleField(f.id)}
                    style={{
                      padding: '3px 10px', fontSize: 11, borderRadius: 99, cursor: isReadonly ? 'default' : 'pointer',
                      fontFamily: 'inherit', border: 'none',
                      background: checked ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: checked ? '#fff' : 'var(--color-text-muted)',
                      outline: checked ? 'none' : '1px solid var(--color-border)',
                      opacity: isReadonly ? 0.6 : 1,
                    }}
                    title={selectedFids.size === 0 && !checked ? 'Alle velden (geen selectie = alles)' : undefined}
                  >
                    {f.name}
                  </button>
                )
              })}
              {selectedFids.size > 0 && !isReadonly && (
                <button type="button" onClick={() => setSelectedFids(new Set())}
                  style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
                  alles
                </button>
              )}
            </div>
          )}
        </div>

        {/* Opslaan */}
        {!isReadonly && (
          <div style={{ marginTop: 10 }}>
            <button onClick={handleSaveScheduleParams} style={{ ...ghostBtn, fontSize: 12 }}>
              Opslaan
            </button>
          </div>
        )}
      </div>

      {/* Waarschuwing: teams maar geen schema */}
      {(hasPools || phaseTeamObjects.length > 0) && phase.match_count === 0 && !isReadonly && (
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
const poolCard      = { flex: '1 1 220px', minWidth: 180, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }
const poolHeader    = { display: 'flex', alignItems: 'center', padding: '7px 12px', background: 'var(--color-primary)', color: '#fff' }
const teamPoolSelect = { fontSize: 11, padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-background)', color: 'var(--color-text)', cursor: 'pointer' }
const sectionLabel  = { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }
const teamChip      = { padding: '3px 10px', fontSize: 12, borderRadius: 99, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
const slotChip      = { padding: '3px 10px', fontSize: 12, borderRadius: 99, fontStyle: 'italic', background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))', border: '1px dashed var(--color-primary)', color: 'var(--color-primary)' }
const actionRow     = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }
const doorGangBox   = { padding: '12px 14px', background: 'rgba(0,0,0,0.03)', border: '1px dashed var(--color-border)', borderRadius: 8, marginBottom: 12 }

function perPoolBtnStyle(active) {
  return {
    width: 32, height: 32, borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-muted)',
    outline: active ? 'none' : '1px solid var(--color-border)',
  }
}
