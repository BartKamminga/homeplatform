import { useState, useEffect } from 'react'
import {
  getPhases, createPhase, updatePhase, deletePhase,
  getTeams, setPhaseTeams, phaseTeamsFromStandings,
  createPoolInPhase, deletePoolInPhase, autoPoolsInPhase,
  generatePhaseSchedule, planPhaseSchedule,
} from '../../api.js'
import { card, cardLabel, ghostBtn, inputStyle, successBanner, errorBanner, deleteBtn } from '../styles.js'

const TYPE_LABEL = { round_robin: 'Round-robin', ko: 'Knock-out' }
const TYPE_COLOR = { round_robin: 'var(--color-primary)', ko: '#d97706' }

function pill(active, color) {
  return {
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${active ? color : 'var(--color-border)'}`,
    background: active ? color : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text)',
    fontWeight: active ? 700 : 400,
  }
}

// ── PhaseCard ──────────────────────────────────────────────────────────────────

function PhaseCard({ phase, allTeams, onRefresh, isAdmin }) {
  const [open,        setOpen]        = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [editName,    setEditName]    = useState(false)
  const [name,        setName]        = useState(phase.name)
  const [nPools,      setNPools]      = useState(2)
  const [startTime,   setStartTime]   = useState('')
  const [positions,   setPositions]   = useState('')
  const [working,     setWorking]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [err,         setErr]         = useState('')

  function flash(text, isErr = false) {
    if (isErr) { setErr(text); setTimeout(() => setErr(''), 3500) }
    else       { setMsg(text); setTimeout(() => setMsg(''), 3000) }
  }

  const phaseTeamIds = new Set((phase.teams || []).map(t => t.id))

  async function handleToggleTeam(teamId) {
    const next = new Set(phaseTeamIds)
    next.has(teamId) ? next.delete(teamId) : next.add(teamId)
    try { await setPhaseTeams(phase.id, [...next]); onRefresh() }
    catch { flash('Opslaan mislukt', true) }
  }

  async function handleAutoPools() {
    setWorking(true)
    try { await autoPoolsInPhase(phase.id, { n_pools: nPools }); onRefresh(); flash('Poules verdeeld') }
    catch { flash('Verdelen mislukt', true) }
    finally { setWorking(false) }
  }

  async function handleAddPool() {
    const n = (phase.pools || []).length + 1
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const poolName = `Poule ${letters[n - 1] || n}`
    try { await createPoolInPhase(phase.id, { name: poolName }); onRefresh() }
    catch { flash('Toevoegen mislukt', true) }
  }

  async function handleDeletePool(poolId) {
    try { await deletePoolInPhase(phase.id, poolId); onRefresh() }
    catch { flash('Verwijderen mislukt', true) }
  }

  async function handleGenSchedule() {
    setWorking(true)
    try { await generatePhaseSchedule(phase.id); onRefresh(); flash('Schema gegenereerd') }
    catch { flash('Genereren mislukt', true) }
    finally { setWorking(false) }
  }

  async function handlePlanSchedule() {
    setWorking(true)
    try { await planPhaseSchedule(phase.id, startTime || null); onRefresh(); flash('Schema ingepland') }
    catch { flash('Inplannen mislukt', true) }
    finally { setWorking(false) }
  }

  async function handleFromStandings() {
    const pos = positions.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean)
    if (!pos.length) return
    setWorking(true)
    try { await phaseTeamsFromStandings(phase.id, pos); onRefresh(); flash('Teams overgenomen uit standen') }
    catch { flash('Overnemen mislukt', true) }
    finally { setWorking(false) }
  }

  async function handleRename() {
    setEditName(false)
    if (name.trim() && name.trim() !== phase.name) {
      try { await updatePhase(phase.id, { name: name.trim() }); onRefresh() }
      catch { flash('Opslaan mislukt', true) }
    } else { setName(phase.name) }
  }

  async function handleDelete() {
    try { await deletePhase(phase.id); onRefresh() }
    catch { flash('Verwijderen mislukt', true) }
  }

  const pools = phase.pools || []
  const unassigned = (phase.teams || []).filter(t => !t.pool_id)

  return (
    <div style={{ ...card, marginBottom: 10 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editName ? (
          <input autoFocus value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setName(phase.name); setEditName(false) } }}
            style={{ ...inputStyle, flex: 1, fontSize: 14, fontWeight: 700 }}
          />
        ) : (
          <button onClick={() => isAdmin && setEditName(true)}
            style={{ flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: isAdmin ? 'text' : 'default', fontFamily: 'inherit' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{phase.name}</span>
            <span style={{ marginLeft: 8, ...pill(false, TYPE_COLOR[phase.type]), cursor: 'default', fontSize: 10 }}>
              {TYPE_LABEL[phase.type] || phase.type}
            </span>
            {pools.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                {pools.length} poule{pools.length !== 1 ? 's' : ''} · {(phase.teams || []).length} teams
              </span>
            )}
          </button>
        )}
        <button onClick={() => setOpen(o => !o)}
          style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px' }}>
          {open ? '▲ Sluiten' : '▼ Beheren'}
        </button>
        {isAdmin && (
          confirmDel ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setConfirmDel(false)} style={{ ...ghostBtn, fontSize: 11, padding: '3px 8px' }}>Nee</button>
              <button onClick={handleDelete}
                style={{ ...ghostBtn, fontSize: 11, padding: '3px 8px', borderColor: '#dc2626', color: '#dc2626' }}>Ja</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={deleteBtn} title="Fase verwijderen">✕</button>
          )
        )}
      </div>

      {msg && <div style={{ ...successBanner, marginTop: 8 }}>{msg}</div>}
      {err && <div style={{ ...errorBanner, marginTop: 8 }}>{err}</div>}

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Teams in fase */}
          {isAdmin && (
            <div>
              <div style={cardLabel}>TEAMS IN DEZE FASE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {allTeams.map(t => {
                  const inPhase = phaseTeamIds.has(t.id)
                  return (
                    <button key={t.id} onClick={() => handleToggleTeam(t.id)} style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                      border: `1px solid ${inPhase ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: inPhase ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: inPhase ? '#fff' : 'var(--color-text)',
                    }}>{t.name}</button>
                  )
                })}
              </div>
              {allTeams.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Voeg eerst teams toe via het Teams-tabblad.
                </div>
              )}
            </div>
          )}

          {/* Poules */}
          {(pools.length > 0 || isAdmin) && (
            <div>
              <div style={cardLabel}>POULES</div>
              {pools.map(pool => (
                <div key={pool.id} style={{
                  padding: '8px 12px', background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{pool.name}</span>
                    {isAdmin && (
                      <button onClick={() => handleDeletePool(pool.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 12 }}>✕</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(pool.teams || []).map(t => (
                      <span key={t.id} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      }}>{t.name}</span>
                    ))}
                    {(pool.teams || []).length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Geen teams</span>
                    )}
                  </div>
                </div>
              ))}
              {unassigned.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Niet ingedeeld: {unassigned.map(t => t.name).join(', ')}
                </div>
              )}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="number" min={1} max={16} value={nPools}
                    onChange={e => setNPools(parseInt(e.target.value) || 2)}
                    style={{ ...inputStyle, width: 56 }}
                  />
                  <button onClick={handleAutoPools} disabled={working}
                    style={{ ...ghostBtn, opacity: working ? 0.5 : 1 }}>
                    Auto-verdelen
                  </button>
                  <button onClick={handleAddPool} style={ghostBtn}>+ Poule</button>
                </div>
              )}
            </div>
          )}

          {/* Vul uit standen */}
          {isAdmin && (
            <div>
              <div style={cardLabel}>VUL UIT STANDEN (posities uit vorige fase)</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={positions} onChange={e => setPositions(e.target.value)}
                  placeholder="bijv. 1,2,3"
                  style={{ ...inputStyle, width: 120 }}
                />
                <button onClick={handleFromStandings} disabled={working || !positions.trim()}
                  style={{ ...ghostBtn, opacity: working || !positions.trim() ? 0.4 : 1 }}>
                  Overnemen
                </button>
              </div>
            </div>
          )}

          {/* Schema */}
          {isAdmin && (
            <div>
              <div style={cardLabel}>SCHEMA</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={handleGenSchedule} disabled={working}
                  style={{ ...ghostBtn, opacity: working ? 0.5 : 1 }}>
                  {working ? 'Bezig…' : '⚙ Genereer schema'}
                </button>
                <input type="datetime-local" value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{ ...inputStyle, fontSize: 12 }}
                />
                <button onClick={handlePlanSchedule} disabled={working}
                  style={{ ...ghostBtn, opacity: working ? 0.5 : 1 }}>
                  📅 Inplannen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── FasesTab ────────────────────────────────────────────────────────────────────

export default function FasesTab({ tournament, isAdmin }) {
  const [phases,   setPhases]   = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [newType,  setNewType]  = useState('round_robin')
  const [creating, setCreating] = useState(false)
  const [err,      setErr]      = useState('')

  useEffect(() => { load() }, [tournament.id])

  async function load() {
    setLoading(true)
    try {
      const [p, t] = await Promise.all([getPhases(tournament.id), getTeams(tournament.id)])
      setPhases(p)
      setAllTeams(t)
    } catch { setErr('Laden mislukt') }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createPhase(tournament.id, { name: newName.trim(), type: newType, order: phases.length })
      setNewName('')
      await load()
    } catch { setErr('Aanmaken mislukt') }
    finally { setCreating(false) }
  }

  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 20 }}>Laden…</div>

  return (
    <div>
      {err && <div style={{ ...errorBanner, marginBottom: 12 }} onClick={() => setErr('')}>{err}</div>}

      {isAdmin && (
        <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Naam nieuwe fase…"
            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.keys(TYPE_LABEL).map(type => (
              <button key={type} onClick={() => setNewType(type)}
                style={pill(newType === type, TYPE_COLOR[type])}>
                {TYPE_LABEL[type]}
              </button>
            ))}
          </div>
          <button onClick={handleCreate} disabled={creating || !newName.trim()}
            style={{ ...ghostBtn, color: 'var(--color-primary)', borderColor: 'var(--color-primary)', opacity: creating || !newName.trim() ? 0.4 : 1 }}>
            + Fase
          </button>
        </div>
      )}

      {phases.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 28 }}>
          Nog geen fases aangemaakt.
        </div>
      ) : (
        phases.map(phase => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            allTeams={allTeams}
            onRefresh={load}
            isAdmin={isAdmin}
          />
        ))
      )}
    </div>
  )
}
