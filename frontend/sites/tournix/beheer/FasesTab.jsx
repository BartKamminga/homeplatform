import { useState, useEffect } from 'react'
import {
  getPhases, createPhase, updatePhase, deletePhase,
  createPoolInPhase, deletePoolInPhase, autoPoolsInPhase,
  preAllocatePhaseTeams, resolvePhaseplaceholders,
  assignTeamPool, getTeams,
} from '../api.js'
import {
  inputStyle, primaryBtn, ghostBtn, noTid,
  card, cardLabel, muted, successBanner, errorBanner,
  typePill, mainPill, deleteBtn, smallDeleteBtn,
  poolCard, poolHeader, teamPoolSelect,
  sectionLabel, teamChip, slotChip, actionRow, doorGangBox,
  perPoolBtnStyle,
} from './styles.js'

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
      setPhases(p); setTeams(t)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
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
    try { await updatePhase(pid, { name }); setEditId(null); await load() }
    catch (e) { flash(e.message, true) }
  }

  async function handleDelete(pid, name) {
    if (!window.confirm(`Fase "${name}" verwijderen? Alle wedstrijden in deze fase worden ook verwijderd.`)) return
    try { await deletePhase(pid); flash('Fase verwijderd'); await load() }
    catch (e) { flash(e.message, true) }
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

// ── DoorGangSection ───────────────────────────────────────────────────────────

function DoorGangSection({ phase, phasePlaceholders, phaseRealTeams, hasPlaceholders, hasRealTeams, isReadonly, flash, onRefresh }) {
  const [perPool, setPerPool] = useState(2)

  async function handleApplySlots() {
    const positions = Array.from({ length: perPool }, (_, i) => i + 1)
    try {
      const r = await preAllocatePhaseTeams(phase.id, positions)
      flash(`${r.created} slots aangemaakt vanuit "${r.source_phase}"`)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleResolve() {
    try {
      const r = await resolvePhaseplaceholders(phase.id)
      if (r.resolved === 0) flash('Nog geen teams op te lossen — vorige fase heeft nog open wedstrijden.', true)
      else { flash(`${r.resolved} teams opgelost`); await onRefresh() }
    } catch (e) { flash(e.message, true) }
  }

  return (
    <div style={doorGangBox}>
      {hasPlaceholders ? (
        <>
          <div style={sectionLabel}>GEPLANDE DOORGANG ({phasePlaceholders.length} slots)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {phasePlaceholders.map(t => <span key={t.id} style={slotChip}>{t.name}</span>)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Worden vervangen door echte teams zodra de vorige fase afgerond is.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleResolve} style={{ ...primaryBtn, fontSize: 12 }}>Oplossen</button>
            {!isReadonly && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Hermaak:</span>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setPerPool(n)} style={perPoolBtnStyle(n === perPool)}>{n}</button>
                ))}
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>per poule</span>
                <button onClick={handleApplySlots} style={{ ...ghostBtn, fontSize: 12 }}>↺ Hermaak</button>
              </>
            )}
          </div>
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
}

// ── ScheduleSettings ──────────────────────────────────────────────────────────

function ScheduleSettings({ phase, isReadonly, flash }) {
  const [duration, setDuration] = useState(phase.match_duration_min ?? 20)
  const [breakMin, setBreakMin] = useState(phase.break_min ?? 5)

  useEffect(() => {
    setDuration(phase.match_duration_min ?? 20)
    setBreakMin(phase.break_min ?? 5)
  }, [phase.id, phase.match_duration_min, phase.break_min])

  async function handleSave() {
    try {
      await updatePhase(phase.id, { match_duration_min: duration, break_min: breakMin })
      flash('Inplanning instellingen opgeslagen')
    } catch (e) { flash(e.message, true) }
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
      <div style={sectionLabel}>INPLANNEN</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Duur</label>
          <input type="number" min="1" max="120" value={duration}
            onChange={e => setDuration(Number(e.target.value))} disabled={isReadonly}
            style={{ ...inputStyle, width: 54, fontSize: 12, padding: '4px 6px' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>min</span>
          <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>Pauze</label>
          <input type="number" min="0" max="60" value={breakMin}
            onChange={e => setBreakMin(Number(e.target.value))} disabled={isReadonly}
            style={{ ...inputStyle, width: 44, fontSize: 12, padding: '4px 6px' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>min</span>
        </div>
      </div>
      {!isReadonly && (
        <div style={{ marginTop: 10 }}>
          <button onClick={handleSave} style={{ ...ghostBtn, fontSize: 12 }}>Opslaan</button>
        </div>
      )}
    </div>
  )
}

// ── CaptureConfig ─────────────────────────────────────────────────────────────

function CaptureConfig({ phase, flash, onRefresh }) {
  const [open,   setOpen]   = useState(false)
  const [type,   setType]   = useState(phase.capture_type   || 'poule')
  const [group,  setGroup]  = useState(phase.capture_group  || '')
  const [ids,    setIds]    = useState(phase.capture_ids    || '')
  const [labels, setLabels] = useState(phase.capture_labels || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setType(phase.capture_type   || 'poule')
    setGroup(phase.capture_group  || '')
    setIds(phase.capture_ids    || '')
    setLabels(phase.capture_labels || '')
  }, [phase.id, phase.capture_type, phase.capture_group, phase.capture_ids, phase.capture_labels])

  const isConfigured = !!phase.capture_type

  async function handleSave() {
    setSaving(true)
    try {
      await updatePhase(phase.id, {
        capture_type:   type   || null,
        capture_group:  group  || null,
        capture_ids:    ids    || null,
        capture_labels: labels || null,
      })
      flash('Vanger-config opgeslagen')
      setOpen(false)
      await onRefresh()
    } catch (e) { flash(e.message, true) }
    finally { setSaving(false) }
  }

  async function handleClear() {
    if (!window.confirm('Vanger-configuratie voor deze fase wissen?')) return
    await updatePhase(phase.id, { capture_type: null, capture_group: null, capture_ids: null, capture_labels: null })
    flash('Vanger-config gewist')
    await onRefresh()
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 12 : 0 }}>
        <div style={sectionLabel} title="Koppel deze fase aan een competitiegroep uit de Hockey Vanger — de vanger haalt automatisch de standen op">HOCKEY VANGER</div>
        {isConfigured && !open && (
          <span style={{ fontSize: 11, background: 'var(--color-primary)', color: '#fff', borderRadius: 99, padding: '1px 8px' }}>
            {phase.capture_type} · {phase.capture_group || '—'}
          </span>
        )}
        <button onClick={() => setOpen(o => !o)}
          style={{ ...ghostBtn, fontSize: 11, marginLeft: 'auto', padding: '3px 10px' }}>
          {open ? 'Sluiten' : isConfigured ? '✏️ Bewerken' : '+ Configureren'}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 90 }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="poule">poule (O14-stijl)</option>
              <option value="full">full (O16-stijl)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 90 }}>Groepnaam</label>
            <input value={group} onChange={e => setGroup(e.target.value)}
              placeholder='bv. "Meisjes O14 Lente · Super"'
              style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 90, paddingTop: 6 }}>
              Capture IDs<br />
              <span style={{ fontWeight: 400, opacity: 0.7 }}>(JSON-array)</span>
            </label>
            <textarea value={ids} onChange={e => setIds(e.target.value)}
              placeholder='["179035","179036","179037"]'
              rows={2}
              style={{ ...inputStyle, flex: 1, minWidth: 240, fontFamily: 'monospace', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 90, paddingTop: 6 }}>
              Labels<br />
              <span style={{ fontWeight: 400, opacity: 0.7 }}>(JSON-array)</span>
            </label>
            <textarea value={labels} onChange={e => setLabels(e.target.value)}
              placeholder='["Poule A","Poule B","Poule C"]'
              rows={2}
              style={{ ...inputStyle, flex: 1, minWidth: 240, fontFamily: 'monospace', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, fontSize: 12 }}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
            {isConfigured && (
              <button onClick={handleClear} style={{ ...ghostBtn, fontSize: 12, color: 'var(--color-error)' }}>
                Wissen
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <strong>poule:</strong> IDs zijn poule-nummers uit de hockey.nl URL · <strong>full:</strong> IDs is de localStorage-sleutel (bv. <code>["comp_22"]</code>)
          </div>
        </div>
      )}
    </div>
  )
}


// ── PhaseCard ─────────────────────────────────────────────────────────────────

function PhaseCard({
  phase, teams, isReadonly,
  editId, editName, setEditId, setEditName,
  onRename, onDelete, flash, onRefresh,
}) {
  const [numPools,    setNumPools]    = useState(2)
  const [newPoolName, setNewPoolName] = useState('')
  const [addingPool,  setAddingPool]  = useState(false)

  const phaseTeamIds = new Set(
    phase.is_main_phase ? teams.map(t => t.id) : phase.teams.map(t => t.team_id)
  )
  const phaseTeamObjects  = teams.filter(t => phaseTeamIds.has(t.id))
  const phasePlaceholders = phaseTeamObjects.filter(t => t.is_placeholder)
  const phaseRealTeams    = phaseTeamObjects.filter(t => !t.is_placeholder)
  const hasPlaceholders   = phasePlaceholders.length > 0
  const hasRealTeams      = phaseRealTeams.length > 0

  const teamsByPool = {}
  for (const p of (phase.pools ?? [])) teamsByPool[p.id] = []
  const unassigned = []
  for (const t of phaseTeamObjects) {
    if (t.pool_id && teamsByPool[t.pool_id] !== undefined) teamsByPool[t.pool_id].push(t)
    else unassigned.push(t)
  }

  async function handleSetKoType(value) {
    try { await updatePhase(phase.id, { ko_type: value }); await onRefresh() }
    catch (e) { flash(e.message, true) }
  }

  async function handleSetPoolType(value) {
    try { await updatePhase(phase.id, { pool_type: value }); await onRefresh() }
    catch (e) { flash(e.message, true) }
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
      setNewPoolName(''); setAddingPool(false); await onRefresh()
    } catch (e) { flash(e.message, true) }
  }

  async function handleDeletePool(poolId, poolName) {
    if (!window.confirm(`Poule "${poolName}" verwijderen?`)) return
    try { await deletePoolInPhase(phase.id, poolId); await onRefresh() }
    catch (e) { flash(e.message, true) }
  }

  async function handleAssignTeamPool(teamId, poolId) {
    try { await assignTeamPool(teamId, poolId || null); await onRefresh() }
    catch (e) { flash(e.message, true) }
  }

  const typeBadge = phase.phase_type === 'ko' ? 'knock-out' : 'round-robin'
  const hasPools  = (phase.pools ?? []).length > 0

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {editId === phase.id ? (
          <input autoFocus value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={() => onRename(phase.id, editName)}
            onKeyDown={e => {
              if (e.key === 'Enter') onRename(phase.id, editName)
              if (e.key === 'Escape') setEditId(null)
            }}
            style={{ ...inputStyle, flex: 1 }} />
        ) : (
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1, cursor: isReadonly ? 'default' : 'pointer' }}
            onClick={() => { if (!isReadonly) { setEditId(phase.id); setEditName(phase.name) } }}
            title={isReadonly ? undefined : 'Klik om naam te bewerken'}>
            {phase.name}
          </span>
        )}
        <span style={typePill}>{typeBadge}</span>
        {phase.is_main_phase && <span style={mainPill}>hoofd</span>}
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{phase.match_count} wedstrijden</span>
        {!isReadonly && <button onClick={() => onDelete(phase.id, phase.name)} style={deleteBtn}>✕</button>}
      </div>

      {/* Pool-type fase */}
      {phase.phase_type === 'pool' && (
        <>
          {!phase.is_main_phase && (
            <DoorGangSection phase={phase} phasePlaceholders={phasePlaceholders} phaseRealTeams={phaseRealTeams}
              hasPlaceholders={hasPlaceholders} hasRealTeams={hasRealTeams} isReadonly={isReadonly} flash={flash} onRefresh={onRefresh} />
          )}

          {!isReadonly && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>SPEELSCHEMA</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ value: 'half', label: 'Halve competitie' }, { value: 'vol', label: 'Hele competitie' }].map(({ value, label }) => {
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

          {hasPools && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(phase.pools ?? []).map(pool => {
                const poolTeams = teamsByPool[pool.id] ?? []
                return (
                  <div key={pool.id} style={poolCard}>
                    <div style={poolHeader}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{pool.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 8 }}>{poolTeams.length} teams</span>
                      {!isReadonly && <button onClick={() => handleDeletePool(pool.id, pool.name)} style={smallDeleteBtn}>✕</button>}
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                      {poolTeams.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen teams</div>
                      ) : poolTeams.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          {t.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: 13, fontStyle: t.is_placeholder ? 'italic' : 'normal', opacity: t.is_placeholder ? 0.7 : 1 }}>{t.name}</span>
                          {!isReadonly && !t.is_placeholder && (
                            <select value={t.pool_id || ''} onChange={e => handleAssignTeamPool(t.id, e.target.value)} style={teamPoolSelect}>
                              <option value="">— geen —</option>
                              {(phase.pools ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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

          {!hasPools && phase.is_main_phase && phaseRealTeams.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>TEAMS ({phaseRealTeams.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {phaseRealTeams.map(t => <span key={t.id} style={teamChip}>{t.name}</span>)}
              </div>
            </div>
          )}

          {!isReadonly && (
            <div style={actionRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={numPools} onChange={e => setNumPools(Number(e.target.value))}
                  style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} poules</option>)}
                </select>
                <button onClick={handleAutoPool} style={{ ...primaryBtn, fontSize: 12 }}>⚡ Auto-verdelen</button>
              </div>
              {addingPool ? (
                <form onSubmit={handleAddPool} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input autoFocus value={newPoolName} onChange={e => setNewPoolName(e.target.value)}
                    placeholder="Poulnaam" style={{ ...inputStyle, width: 120, fontSize: 12 }} />
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
              <DoorGangSection phase={phase} phasePlaceholders={phasePlaceholders} phaseRealTeams={phaseRealTeams}
                hasPlaceholders={hasPlaceholders} hasRealTeams={hasRealTeams} isReadonly={isReadonly} flash={flash} onRefresh={onRefresh} />
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
                        <button key={value} onClick={() => !disabled && handleSetKoType(value)} disabled={disabled}
                          style={{ padding: '4px 14px', fontSize: 12, borderRadius: 99, cursor: disabled ? 'default' : 'pointer',
                            fontFamily: 'inherit', border: 'none',
                            background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: active ? '#fff' : disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
                            outline: active ? 'none' : '1px solid var(--color-border)',
                            opacity: disabled ? 0.45 : 1 }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <CaptureConfig phase={phase} flash={flash} onRefresh={onRefresh} />

      <ScheduleSettings phase={phase} isReadonly={isReadonly} flash={flash} />

      {(hasPools || phaseTeamObjects.length > 0) && phase.match_count === 0 && !isReadonly && (
        <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 8 }}>
          Teams zijn toegewezen maar er is nog geen schema gegenereerd.
        </div>
      )}
    </div>
  )
}
