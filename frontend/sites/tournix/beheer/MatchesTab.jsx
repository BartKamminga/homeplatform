import { useState, useEffect } from 'react'
import {
  getMatches, createMatch, updateMatch, deleteMatch, setResult,
  getTeams, getFields, getSnapshots, saveSnapshot,
  getPhases, generatePhaseSchedule, planPhaseSchedule,
} from '../api.js'
import { inputStyle, primaryBtn, ghostBtn, noTid, successBanner, errorBanner } from './styles.js'
import { resolveTeam } from '../helpers.js'

/* ── Add-match popup ── */
function AddMatchPopup({ tid, teams, fields, onClose, onCreated }) {
  const [teamA,   setTeamA]   = useState('')
  const [teamB,   setTeamB]   = useState('')
  const [fieldId, setFieldId] = useState('')
  const [round,   setRound]   = useState('')
  const [time,    setTime]    = useState('')
  const [saving,  setSaving]  = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createMatch(tid, {
        team_a_id: teamA || null,
        team_b_id: teamB || null,
        field_id: fieldId || null,
        round: round ? parseInt(round) : null,
        scheduled_at: time || null,
      })
      onCreated()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Wedstrijd toevoegen</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>×</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={teamA} onChange={e => setTeamA(e.target.value)} style={inputStyle}>
              <option value="">Team A</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={teamB} onChange={e => setTeamB(e.target.value)} style={inputStyle}>
              <option value="">Team B</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={fieldId} onChange={e => setFieldId(e.target.value)} style={inputStyle}>
              <option value="">Veld</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input type="number" value={round} onChange={e => setRound(e.target.value)}
              placeholder="Ronde" style={inputStyle} />
          </div>
          <input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Annuleer</button>
            <button type="submit" disabled={saving} style={{ ...primaryBtn, flex: 1 }}>{saving ? 'Toevoegen…' : '+ Wedstrijd'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Single match card ── */
function MatchCard({ m, teamMap, fieldMap, matchMap, fields, canScore, onRefresh, structureLocked }) {
  const [scoreEdit,      setScoreEdit]      = useState(false)
  const [scoreA,         setScoreA]         = useState('')
  const [scoreB,         setScoreB]         = useState('')
  const [shootoutWinner, setShootoutWinner] = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [fieldEdit,      setFieldEdit]      = useState(false)

  async function saveResult() {
    if (scoreA === '' || scoreB === '') return
    setSaving(true)
    try {
      const data = { score_a: parseInt(scoreA), score_b: parseInt(scoreB) }
      if (m.match_type === 'ko') data.shootout_winner = shootoutWinner
      await setResult(m.id, data)
      setScoreEdit(false); setScoreA(''); setScoreB('')
      setShootoutWinner(null)
      await onRefresh()
    } finally { setSaving(false) }
  }

  async function saveField(fid) {
    await updateMatch(m.id, { field_id: fid || null })
    setFieldEdit(false)
    await onRefresh()
  }

  async function handleDelete() {
    if (!window.confirm('Wedstrijd verwijderen?')) return
    await deleteMatch(m.id)
    await onRefresh()
  }

  function openScoreEdit() {
    setScoreA(m.status === 'finished' ? String(m.score_a) : '')
    setScoreB(m.status === 'finished' ? String(m.score_b) : '')
    setShootoutWinner(m.shootout_winner ?? null)
    setScoreEdit(true)
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        {m.match_type === 'ko' && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: 'var(--color-warning)', color: '#fff', marginRight: 4 }}>KO</span>
        )}
        <span style={{ fontWeight: 600 }}>{resolveTeam(m.team_a_id, m.source_match_a_id, m.source_a_takes, teamMap, matchMap)?.name ?? '—'}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {m.status === 'finished'
            ? `${m.score_a}–${m.score_b}${m.shootout_winner ? ' (PSO)' : ''}`
            : 'vs'}
        </span>
        <span style={{ fontWeight: 600 }}>{resolveTeam(m.team_b_id, m.source_match_b_id, m.source_b_takes, teamMap, matchMap)?.name ?? '—'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {canScore && !scoreEdit && (
            <button onClick={openScoreEdit}
              style={{ ...ghostBtn, padding: '4px 10px', fontSize: 11 }}>
              {m.status === 'finished' ? 'Wijzig' : 'Uitslag'}
            </button>
          )}
          {!structureLocked && (
            <button onClick={handleDelete}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* Meta row: ronde, veld, tijd */}
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {m.round && <span>Ronde {m.round}</span>}
        {fieldEdit ? (
          <select autoFocus defaultValue={m.field_id ?? ''}
            onChange={e => saveField(e.target.value)}
            onBlur={() => setFieldEdit(false)}
            style={{ ...inputStyle, fontSize: 11, padding: '2px 6px', height: 24 }}>
            <option value="">— geen veld —</option>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        ) : (
          <span
            onClick={() => !structureLocked && setFieldEdit(true)}
            style={{ cursor: structureLocked ? 'default' : 'pointer',
              borderBottom: structureLocked ? 'none' : '1px dashed var(--color-border)' }}>
            {m.field_id && fieldMap[m.field_id] ? fieldMap[m.field_id].name : '—'}
          </span>
        )}
        {m.scheduled_at && (
          <span>{new Date(m.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      {scoreEdit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min="0" value={scoreA} onChange={e => setScoreA(e.target.value)}
              style={{ ...inputStyle, width: 52, textAlign: 'center' }} placeholder="0" autoFocus />
            <span>–</span>
            <input type="number" min="0" value={scoreB} onChange={e => setScoreB(e.target.value)}
              style={{ ...inputStyle, width: 52, textAlign: 'center' }} placeholder="0" />
            <button onClick={saveResult} disabled={saving || scoreA === '' || scoreB === ''} style={{ ...primaryBtn, padding: '6px 14px', fontSize: 12, opacity: (saving || scoreA === '' || scoreB === '') ? 0.6 : 1 }}>
              {saving ? '…' : 'Opslaan'}
            </button>
            <button onClick={() => setScoreEdit(false)} style={ghostBtn}>Annuleer</button>
          </div>
          {m.match_type === 'ko' && scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>PSO gewonnen door:</span>
              {[['a', teamMap[m.team_a_id]?.name], ['b', teamMap[m.team_b_id]?.name]].map(([key, name]) => (
                <button key={key} type="button"
                  onClick={() => setShootoutWinner(prev => prev === key ? null : key)}
                  style={{ padding: '3px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${shootoutWinner === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: shootoutWinner === key ? 'var(--color-primary)' : 'transparent',
                    color: shootoutWinner === key ? '#fff' : 'var(--color-text-muted)', fontWeight: shootoutWinner === key ? 600 : 400 }}>
                  {name ?? '—'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Compact score row for round entry view ── */
function ScoreRow({ m, teamMap, fields, tournamentDate, onRefresh }) {
  const [scoreA,         setScoreA]         = useState(m.status === 'finished' ? String(m.score_a) : '0')
  const [scoreB,         setScoreB]         = useState(m.status === 'finished' ? String(m.score_b) : '0')
  const [shootoutWinner, setShootoutWinner] = useState(m.shootout_winner ?? null)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(m.status === 'finished')
  const [saveError,      setSaveError]      = useState('')
  const [matchTime,      setMatchTime]      = useState(m.scheduled_at ? m.scheduled_at.slice(11, 16) : '')
  const [matchField,     setMatchField]     = useState(m.field_id ?? '')

  useEffect(() => {
    if (m.status === 'finished') {
      setScoreA(String(m.score_a)); setScoreB(String(m.score_b)); setSaved(true)
      setShootoutWinner(m.shootout_winner ?? null)
    }
  }, [m.score_a, m.score_b, m.status, m.shootout_winner])

  useEffect(() => {
    setMatchTime(m.scheduled_at ? m.scheduled_at.slice(11, 16) : '')
    setMatchField(m.field_id ?? '')
  }, [m.scheduled_at, m.field_id])

  async function saveSchedule(time, fieldId) {
    const base = tournamentDate ? tournamentDate.split('T')[0] : new Date().toISOString().split('T')[0]
    const scheduled_at = time ? `${base}T${time}:00` : null
    try { await updateMatch(m.id, { scheduled_at, field_id: fieldId || null }) }
    catch (e) { /* silent — niet kritisch */ }
  }

  async function save() {
    if (scoreA === '' || scoreB === '') return
    setSaving(true); setSaveError('')
    try {
      const data = { score_a: parseInt(scoreA), score_b: parseInt(scoreB) }
      if (m.match_type === 'ko') data.shootout_winner = shootoutWinner
      await setResult(m.id, data)
      setSaved(true)
      await onRefresh()
    } catch (e) {
      setSaveError(e.message)
    } finally { setSaving(false) }
  }

  const isKo   = m.match_type === 'ko'
  const tied   = scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB)
  const dirty  = m.status !== 'finished'
              || scoreA !== String(m.score_a)
              || scoreB !== String(m.score_b)
              || (isKo && shootoutWinner !== (m.shootout_winner ?? null))

  const nameA = teamMap[m.team_a_id]?.name ?? '—'
  const nameB = teamMap[m.team_b_id]?.name ?? '—'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      background: saved && !dirty ? 'var(--color-surface-2)' : 'var(--color-surface)',
      border: `1px solid ${saveError ? 'var(--color-danger)' : dirty ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 8, padding: '8px 10px', minWidth: 0,
    }}>
      {/* Team A */}
      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</div>
      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, margin: '2px 0' }}>
        <input type="number" min="0" value={scoreA} onChange={e => { setScoreA(e.target.value); setSaved(false); setSaveError('') }}
          style={{ ...inputStyle, width: 38, textAlign: 'center', padding: '3px 4px', fontSize: 15, fontWeight: 700 }} placeholder="—" />
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, fontSize: 12 }}>–</span>
        <input type="number" min="0" value={scoreB} onChange={e => { setScoreB(e.target.value); setSaved(false); setSaveError('') }}
          style={{ ...inputStyle, width: 38, textAlign: 'center', padding: '3px 4px', fontSize: 15, fontWeight: 700 }} placeholder="—" />
      </div>
      {/* Team B */}
      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{nameB}</div>
      {/* PSO (KO gelijkspel) */}
      {isKo && tied && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 2 }}>
          {[['a', nameA], ['b', nameB]].map(([key, name]) => (
            <button key={key} type="button"
              onClick={() => { setShootoutWinner(prev => prev === key ? null : key); setSaved(false) }}
              style={{ flex: 1, padding: '2px 4px', fontSize: 10, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${shootoutWinner === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: shootoutWinner === key ? 'var(--color-primary)' : 'transparent',
                color: shootoutWinner === key ? '#fff' : 'var(--color-text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: shootoutWinner === key ? 600 : 400 }}>
              {name}
            </button>
          ))}
        </div>
      )}
      {/* Opslaan */}
      <button onClick={save} disabled={saving || scoreA === '' || scoreB === '' || !dirty}
        style={{ marginTop: 2, padding: '4px 0', borderRadius: 6, fontSize: 11, border: 'none', fontFamily: 'inherit',
          fontWeight: 600, cursor: (saving || scoreA === '' || scoreB === '' || !dirty) ? 'default' : 'pointer',
          background: dirty ? 'var(--color-primary)' : 'transparent',
          color: dirty ? '#fff' : 'var(--color-success)',
          opacity: (saving || scoreA === '' || scoreB === '' || !dirty) ? 0.55 : 1 }}>
        {saving ? '…' : saved && !dirty ? '✓ Opgeslagen' : 'Opslaan'}
      </button>
      {saveError && <div style={{ fontSize: 10, color: 'var(--color-danger)' }}>{saveError}</div>}
      {/* Tijd + veld */}
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <input type="time" value={matchTime}
          onChange={e => setMatchTime(e.target.value)}
          onBlur={e => saveSchedule(e.target.value, matchField)}
          style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '2px 4px', textAlign: 'center' }} />
        {fields && fields.length > 0 && (
          <select value={matchField}
            onChange={e => { setMatchField(e.target.value); saveSchedule(matchTime, e.target.value) }}
            style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '2px 4px' }}>
            <option value="">— veld —</option>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

/* ── Main tab ── */
export default function MatchesTab({ tid, tournament, pools, teams: teamsFromParent, stage }) {
  const active          = tournament
  const structureLocked = stage !== 'inregel'
  const canScore        = true  // admin kan altijd scores aanpassen (#87)

  const [matches,    setMatches]    = useState([])
  const [localTeams, setLocalTeams] = useState([])
  const [fields,     setFields]     = useState([])
  const [phases,     setPhases]     = useState([])
  const [snapshots,  setSnapshots]  = useState([])
  const [snapSaving, setSnapSaving] = useState(null)
  const [genMsg,     setGenMsg]     = useState({ text: '', isErr: false })
  const [genLoading, setGenLoading] = useState(null)  // null | phase_id
  const [planLoading, setPlanLoading] = useState(null) // null | phase_id
  const [planMsg,     setPlanMsg]     = useState({ text: '', isErr: false })
  const [phaseStartTimes, setPhaseStartTimes] = useState({})  // { [phase_id]: datetime-local string }
  const [showAdd,         setShowAdd]         = useState(false)

  async function load() {
    if (!tid) return
    const [m, t, f, p] = await Promise.all([
      getMatches(tid).catch(() => []),
      getTeams(tid).catch(() => []),
      getFields(tid).catch(() => []),
      getPhases(tid).catch(() => []),
    ])
    setMatches(m); setLocalTeams(t); setFields(f); setPhases(p)
    getSnapshots(tid).then(setSnapshots).catch(() => {})
  }

  useEffect(() => { load() }, [tid])

  const teams    = localTeams.length ? localTeams : (teamsFromParent ?? [])
  const teamMap  = Object.fromEntries(teams.map(t => [t.id, t]))
  const fieldMap = Object.fromEntries(fields.map(f => [f.id, f]))
  const rounds   = [...new Set(matches.map(m => m.round).filter(r => r != null))].sort((a, b) => a - b)
  const savedRounds = new Set(snapshots.map(s => s.round))

  const poolMatches = matches.filter(m => m.match_type !== 'ko')
  const koMatches   = matches.filter(m => m.match_type === 'ko')

  const matchesByPool = {}
  const unmapped = []
  poolMatches.forEach(m => {
    const pid = teamMap[m.team_a_id]?.pool_id ?? null
    if (pid) {
      if (!matchesByPool[pid]) matchesByPool[pid] = []
      matchesByPool[pid].push(m)
    } else { unmapped.push(m) }
  })

  async function handleGeneratePhase(pid) {
    setGenLoading(pid); setGenMsg({ text: '', isErr: false })
    try {
      const result = await generatePhaseSchedule(pid)
      await load()
      setGenMsg({ text: `${result?.created ?? '?'} wedstrijden aangemaakt`, isErr: false })
      setTimeout(() => setGenMsg({ text: '', isErr: false }), 3000)
    } catch (e) {
      setGenMsg({ text: `Fout: ${e.message}`, isErr: true })
      setTimeout(() => setGenMsg({ text: '', isErr: false }), 4000)
    } finally { setGenLoading(null) }
  }

  async function handlePlanPhase(ph) {
    if (!window.confirm(`Schema inplannen voor "${ph.name}"? Bestaande tijden en velden worden overschreven.`)) return
    setPlanLoading(ph.id); setPlanMsg({ text: '', isErr: false })
    try {
      const startTime = phaseStartTimes[ph.id] || null
      const r = await planPhaseSchedule(ph.id, startTime)
      await load()
      const conflictWarn = r.conflicts > 0 ? ` — ⚠️ ${r.conflicts} veldconflict(en)` : ''
      setPlanMsg({ text: `${r.updated} wedstrijden ingepland in ${r.slots} slots${conflictWarn}`, isErr: false })
      setTimeout(() => setPlanMsg({ text: '', isErr: false }), 3000)
    } catch (e) {
      setPlanMsg({ text: `Fout: ${e.message}`, isErr: true })
      setTimeout(() => setPlanMsg({ text: '', isErr: false }), 4000)
    } finally { setPlanLoading(null) }
  }

  const matchMap  = Object.fromEntries(matches.map(m => [m.id, m]))
  const cardProps = { teamMap, fieldMap, matchMap, fields, canScore, onRefresh: load, structureLocked }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Schema genereren per fase — alleen in inregel */}
      {!structureLocked && phases.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10 }}>SCHEMA GENEREREN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phases.map(ph => {
              const phaseMatchCount = matches.filter(m => m.phase_id === ph.id).length
              const isLoading = genLoading === ph.id
              return (
                <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{ph.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 99,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)' }}>
                    {ph.phase_type === 'ko' ? 'knock-out' : 'round-robin'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 80, textAlign: 'right' }}>
                    {phaseMatchCount} wedstrijden
                  </span>
                  <button
                    onClick={() => handleGeneratePhase(ph.id)}
                    disabled={genLoading !== null}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                      background: phaseMatchCount > 0 ? 'var(--color-warning)' : 'var(--color-primary)',
                      color: '#fff', cursor: genLoading !== null ? 'default' : 'pointer',
                      fontWeight: 600, opacity: genLoading !== null ? 0.6 : 1, minWidth: 80 }}>
                    {isLoading ? '…' : phaseMatchCount > 0 ? 'Hermaak' : 'Genereer'}
                  </button>
                </div>
              )
            })}
          </div>
          {genMsg.text && <div style={{ ...genMsg.isErr ? errorBanner : successBanner, marginTop: 8 }}>{genMsg.text}</div>}
        </div>
      )}

      {/* Inplannen per fase — inregel + test, niet productie */}
      {stage !== 'productie' && phases.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10 }}>INPLANNEN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phases.map(ph => {
              const phaseMatchCount = matches.filter(m => m.phase_id === ph.id).length
              const isLoading = planLoading === ph.id
              const params = ph.match_duration_min ? `${ph.match_duration_min} min · ${ph.break_min ?? 5} min pauze` : ''
              return (
                <div key={ph.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{ph.name}</span>
                    {params && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{params}</span>}
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {phaseMatchCount} wedstrijden
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="datetime-local"
                      value={phaseStartTimes[ph.id] || ''}
                      onChange={e => setPhaseStartTimes(prev => ({ ...prev, [ph.id]: e.target.value }))}
                      style={{ ...inputStyle, fontSize: 11, padding: '3px 6px', flex: 1, maxWidth: 200 }}
                    />
                    <button
                      onClick={() => handlePlanPhase(ph)}
                      disabled={planLoading !== null || phaseMatchCount === 0}
                      style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                        background: 'var(--color-primary)', color: '#fff',
                        cursor: (planLoading !== null || phaseMatchCount === 0) ? 'default' : 'pointer',
                        fontWeight: 600, opacity: (planLoading !== null || phaseMatchCount === 0) ? 0.5 : 1, minWidth: 80 }}>
                      {isLoading ? '…' : 'Plan in'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {planMsg.text && <div style={{ ...planMsg.isErr ? errorBanner : successBanner, marginTop: 8 }}>{planMsg.text}</div>}
        </div>
      )}

      {/* Uitslagen per ronde — alleen in productie */}
      {canScore && rounds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rounds.map(r => {
            const roundMatches = matches.filter(m => m.round === r)
            const allDone = roundMatches.length > 0 && roundMatches.every(m => m.status === 'finished')
            return (
              <div key={r} style={{ background: 'var(--color-surface-2)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Round header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)',
                    letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Ronde {r}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {allDone && (
                      <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>Volledig</span>
                    )}
                    <button onClick={async () => {
                      setSnapSaving(r)
                      try { await saveSnapshot(tid, r); setSnapshots(await getSnapshots(tid)) }
                      finally { setSnapSaving(null) }
                    }} disabled={snapSaving === r || !allDone}
                      style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, fontFamily: 'inherit', cursor: (snapSaving === r || !allDone) ? 'default' : 'pointer',
                        border: '1px solid var(--color-border)',
                        background: savedRounds.has(r) ? 'var(--color-success)' : 'var(--color-surface)',
                        color: savedRounds.has(r) ? '#fff' : 'var(--color-text)',
                        opacity: (snapSaving === r || !allDone) ? 0.5 : 1, fontWeight: 600 }}>
                      {snapSaving === r ? '…' : savedRounds.has(r) ? 'Snapshot ✓' : 'Bewaar snapshot'}
                    </button>
                  </div>
                </div>
                {/* Score rows */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, padding: '8px 10px' }}>
                  {roundMatches.map(m => (
                    <ScoreRow key={m.id} m={m} teamMap={teamMap} fields={fields} tournamentDate={active?.date} onRefresh={load} />
                  ))}
                </div>
              </div>
            )
          })}
          {/* Matches without a round */}
          {matches.filter(m => m.round == null && m.match_type !== 'ko').length > 0 && (
            <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)',
                fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zonder ronde</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, padding: '8px 10px' }}>
                {matches.filter(m => m.round == null && m.match_type !== 'ko').map(m => (
                  <ScoreRow key={m.id} m={m} teamMap={teamMap} fields={fields} tournamentDate={active?.date} onRefresh={load} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* KO */}
      {koMatches.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '4px 0 6px', borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
            Knock-out
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {koMatches.map(m => <MatchCard key={m.id} m={m} {...cardProps} />)}
          </div>
        </div>
      )}

      {/* Wedstrijd toevoegen — floating button, alleen in inregel */}
      {!structureLocked && (
        <button onClick={() => setShowAdd(true)}
          style={{ ...primaryBtn, alignSelf: 'flex-start', marginTop: 4 }}>
          + Wedstrijd toevoegen
        </button>
      )}

      {showAdd && (
        <AddMatchPopup
          tid={tid}
          teams={teams}
          fields={fields}
          onClose={() => setShowAdd(false)}
          onCreated={async () => { setShowAdd(false); await load() }}
        />
      )}

    </div>
  )
}
