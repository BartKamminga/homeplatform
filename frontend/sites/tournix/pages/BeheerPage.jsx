import { useState, useEffect } from 'react'
import {
  getTournaments, createTournament, updateTournament,
  getTeams, createTeam, deleteTeam,
  getFields, createField,
  getMatches, createMatch, setResult,
  updateTournamentStage, saveSnapshot, getSnapshots,
} from '../api.js'

const TABS = ['Toernooi', 'Teams', 'Velden', 'Wedstrijden']

export default function BeheerPage({ stage, onStageChange }) {
  const [tab,  setTab]  = useState('Toernooi')
  const [tid,  setTid]  = useState(null)
  const [list, setList] = useState([])

  useEffect(() => {
    getTournaments().then(l => {
      setList(l)
      const act = l.find(t => t.status === 'active') ?? l[0] ?? null
      if (act) setTid(act.id)
    }).catch(() => {})
  }, [])

  const active = list.find(t => t.id === tid) ?? null

  async function loadTournaments() {
    const l = await getTournaments()
    setList(l)
    if (!tid && l[0]) setTid(l[0].id)
    if (onStageChange) onStageChange()
  }

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Beheer</h1>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
            borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer',
            border: `1px solid ${tab === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)',
            color: tab === t ? '#fff' : 'var(--color-text)',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Toernooi'    && <TournamentTab list={list} active={active} tid={tid} setTid={setTid} onRefresh={loadTournaments} />}
      {tab === 'Teams'       && <TeamsTab     tid={tid} />}
      {tab === 'Velden'      && <FieldsTab    tid={tid} />}
      {tab === 'Wedstrijden' && <MatchesTab   tid={tid} tournament={active} />}
    </div>
  )
}

/* ── Toernooi ── */
function TournamentTab({ list, active, tid, setTid, onRefresh }) {
  const [name,     setName]     = useState('')
  const [location, setLocation] = useState('')
  const [date,     setDate]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      await createTournament({ name: name.trim(), location: location || null, date: date || null })
      setName(''); setLocation(''); setDate('')
      await onRefresh()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function activate(id) {
    await updateTournament(id, { status: 'active' })
    await onRefresh()
  }

  async function handleStageChange(newStage) {
    if (!active) return
    await updateTournamentStage(active.id, newStage)
    await onRefresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Lijst */}
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--color-surface)', border: `1px solid ${t.id === tid ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {t.status} {t.location ? `· ${t.location}` : ''}
                </div>
              </div>
              {t.id !== tid && <button onClick={() => setTid(t.id)} style={ghostBtn}>Selecteer</button>}
              {t.status !== 'active' && <button onClick={() => activate(t.id)} style={ghostBtn}>Activeer</button>}
            </div>
          ))}
        </div>
      )}

      {/* Stage management */}
      {active && (
        <div style={{ marginTop: 0, padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            FASE
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['inregel', 'test', 'productie'].map(s => (
              <button
                key={s}
                onClick={() => handleStageChange(s)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: active.stage === s ? 'none' : '1px solid var(--color-border)',
                  background: active.stage === s
                    ? (s === 'inregel' ? 'var(--color-primary)' : s === 'test' ? 'var(--color-warning)' : 'var(--color-success)')
                    : 'transparent',
                  color: active.stage === s ? '#fff' : 'var(--color-text-muted)',
                  cursor: 'pointer', fontWeight: active.stage === s ? 600 : 400,
                  fontFamily: 'inherit',
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            {active.stage === 'inregel' && 'Vrij bewerken — teams, velden en wedstrijden aanmaken.'}
            {active.stage === 'test' && 'Bevroren data — scores simuleren zonder opslaan.'}
            {active.stage === 'productie' && 'Live — scores worden opgeslagen, voorspellingen tellen mee.'}
            {!active.stage && 'Kies een fase om te activeren.'}
          </div>
        </div>
      )}

      {/* Nieuw aanmaken */}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={labelStyle}>Nieuw toernooi</label>
        {error && <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Naam *" style={inputStyle} required />
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Locatie" style={inputStyle} />
        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        <button type="submit" disabled={saving} style={primaryBtn}>
          {saving ? 'Aanmaken…' : 'Toernooi aanmaken'}
        </button>
      </form>
    </div>
  )
}

/* ── Teams ── */
function TeamsTab({ tid }) {
  const [teams, setTeams] = useState([])
  const [name,  setName]  = useState('')
  const [color, setColor] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (tid) getTeams(tid).then(setTeams).catch(() => {}) }, [tid])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !tid) return
    setSaving(true)
    try {
      await createTeam(tid, { name: name.trim(), color: color || null })
      setName(''); setColor('')
      setTeams(await getTeams(tid))
    } finally { setSaving(false) }
  }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {teams.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
          {t.color && <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.name}</span>
          <button onClick={async () => { await deleteTeam(t.id); setTeams(await getTeams(tid)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16 }}>×</button>
        </div>
      ))}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Teamnaam" style={{ ...inputStyle, flex: 1 }} required />
        <input type="color" value={color || '#888888'} onChange={e => setColor(e.target.value)} title="Kleur" style={{ width: 40, height: 38, borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }} />
        <button type="submit" disabled={saving} style={primaryBtn}>{saving ? '…' : '+ Team'}</button>
      </form>
    </div>
  )
}

/* ── Velden ── */
function FieldsTab({ tid }) {
  const [fields, setFields] = useState([])
  const [name,   setName]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (tid) getFields(tid).then(setFields).catch(() => {}) }, [tid])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !tid) return
    setSaving(true)
    try {
      await createField(tid, { name: name.trim() })
      setName('')
      setFields(await getFields(tid))
    } finally { setSaving(false) }
  }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fields.map(f => (
        <div key={f.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 500 }}>{f.name}</div>
      ))}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Veldnaam" style={{ ...inputStyle, flex: 1 }} required />
        <button type="submit" disabled={saving} style={primaryBtn}>{saving ? '…' : '+ Veld'}</button>
      </form>
    </div>
  )
}

/* ── Wedstrijden ── */
function MatchesTab({ tid, tournament }) {
  const [matches,   setMatches]   = useState([])
  const [teams,     setTeams]     = useState([])
  const [fields,    setFields]    = useState([])
  const [teamA,     setTeamA]     = useState('')
  const [teamB,     setTeamB]     = useState('')
  const [fieldId,   setFieldId]   = useState('')
  const [round,     setRound]     = useState('')
  const [time,      setTime]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [scoreEdit, setScoreEdit] = useState(null)
  const [scoreA,    setScoreA]    = useState('')
  const [scoreB,    setScoreB]    = useState('')
  const [snapshots, setSnapshots] = useState([])
  const [snapSaving, setSnapSaving] = useState(null)

  useEffect(() => {
    if (!tid) return
    Promise.all([getMatches(tid), getTeams(tid), getFields(tid)])
      .then(([m, t, f]) => { setMatches(m); setTeams(t); setFields(f) })
      .catch(() => {})
    getSnapshots(tid).then(setSnapshots).catch(() => {})
  }, [tid])

  const teamMap  = Object.fromEntries(teams.map(t  => [t.id, t]))
  const fieldMap = Object.fromEntries(fields.map(f => [f.id, f]))

  // Collect distinct rounds from matches
  const rounds = [...new Set(matches.map(m => m.round).filter(r => r != null))].sort((a, b) => a - b)
  const savedRounds = new Set(snapshots.map(s => s.round))

  async function submit(e) {
    e.preventDefault()
    if (!tid) return
    setSaving(true)
    try {
      await createMatch(tid, {
        team_a_id:    teamA    || null,
        team_b_id:    teamB    || null,
        field_id:     fieldId  || null,
        round:        round    ? parseInt(round) : null,
        scheduled_at: time     || null,
      })
      setTeamA(''); setTeamB(''); setFieldId(''); setRound(''); setTime('')
      setMatches(await getMatches(tid))
    } finally { setSaving(false) }
  }

  async function saveResult(mid) {
    await setResult(mid, { score_a: parseInt(scoreA), score_b: parseInt(scoreB) })
    setScoreEdit(null); setScoreA(''); setScoreB('')
    setMatches(await getMatches(tid))
  }

  async function handleSaveSnapshot(r) {
    setSnapSaving(r)
    try {
      await saveSnapshot(tid, r)
      const updated = await getSnapshots(tid)
      setSnapshots(updated)
    } finally { setSnapSaving(null) }
  }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Snapshot buttons per round */}
      {rounds.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            SNAPSHOTS
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rounds.map(r => (
              <button
                key={r}
                onClick={() => handleSaveSnapshot(r)}
                disabled={snapSaving === r}
                style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  background: savedRounds.has(r) ? 'var(--color-success)' : 'var(--color-surface)',
                  color: savedRounds.has(r) ? '#fff' : 'var(--color-text)',
                  opacity: snapSaving === r ? 0.6 : 1,
                }}
              >
                {snapSaving === r ? '…' : savedRounds.has(r) ? `Ronde ${r} ✓` : `Bewaar ronde ${r}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {matches.map(m => (
        <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{teamMap[m.team_a_id]?.name ?? '—'}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {m.status === 'finished' ? `${m.score_a}–${m.score_b}` : 'vs'}
            </span>
            <span style={{ fontWeight: 600 }}>{teamMap[m.team_b_id]?.name ?? '—'}</span>
            {m.status !== 'finished' && (
              <button onClick={() => { setScoreEdit(m.id); setScoreA(''); setScoreB('') }} style={{ ...ghostBtn, marginLeft: 'auto' }}>Uitslag</button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 10 }}>
            {m.round && <span>Ronde {m.round}</span>}
            {m.field_id && fieldMap[m.field_id] && <span>{fieldMap[m.field_id].name}</span>}
            {m.scheduled_at && <span>{new Date(m.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {scoreEdit === m.id && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <input type="number" min="0" value={scoreA} onChange={e => setScoreA(e.target.value)} style={{ ...inputStyle, width: 52, textAlign: 'center' }} placeholder="0" />
              <span>–</span>
              <input type="number" min="0" value={scoreB} onChange={e => setScoreB(e.target.value)} style={{ ...inputStyle, width: 52, textAlign: 'center' }} placeholder="0" />
              <button onClick={() => saveResult(m.id)} style={primaryBtn}>Opslaan</button>
              <button onClick={() => setScoreEdit(null)} style={ghostBtn}>Annuleer</button>
            </div>
          )}
        </div>
      ))}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
        <label style={labelStyle}>Wedstrijd toevoegen</label>
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
          <input type="number" value={round} onChange={e => setRound(e.target.value)} placeholder="Ronde" style={inputStyle} />
        </div>
        <input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
        <button type="submit" disabled={saving} style={primaryBtn}>{saving ? 'Toevoegen…' : '+ Wedstrijd'}</button>
      </form>
    </div>
  )
}

const inputStyle  = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }
const labelStyle  = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }
const primaryBtn  = { padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn    = { padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }
const noTid       = { fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }
