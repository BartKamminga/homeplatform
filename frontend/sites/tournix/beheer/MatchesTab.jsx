import { useState, useEffect } from 'react'
import {
  getMatches, createMatch, updateMatch, deleteMatch, setResult,
  getTeams, getFields, getSnapshots, saveSnapshot,
  generateSchedule, generateKnockout,
} from '../api.js'
import { inputStyle, primaryBtn, ghostBtn, noTid } from './styles.js'

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
function MatchCard({ m, teamMap, fieldMap, fields, canScore, onRefresh, structureLocked }) {
  const [scoreEdit,  setScoreEdit]  = useState(false)
  const [scoreA,     setScoreA]     = useState('')
  const [scoreB,     setScoreB]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [fieldEdit,  setFieldEdit]  = useState(false)

  async function saveResult() {
    if (scoreA === '' || scoreB === '') return
    setSaving(true)
    try {
      await setResult(m.id, { score_a: parseInt(scoreA), score_b: parseInt(scoreB) })
      setScoreEdit(false); setScoreA(''); setScoreB('')
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
    setScoreEdit(true)
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        {m.match_type === 'ko' && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: 'var(--color-warning)', color: '#fff', marginRight: 4 }}>KO</span>
        )}
        <span style={{ fontWeight: 600 }}>{teamMap[m.team_a_id]?.name ?? '—'}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {m.status === 'finished' ? `${m.score_a}–${m.score_b}` : 'vs'}
        </span>
        <span style={{ fontWeight: 600 }}>{teamMap[m.team_b_id]?.name ?? '—'}</span>
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
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
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
      )}
    </div>
  )
}

/* ── Compact score row for round entry view ── */
function ScoreRow({ m, teamMap, onRefresh }) {
  const [scoreA,    setScoreA]    = useState(m.status === 'finished' ? String(m.score_a) : '0')
  const [scoreB,    setScoreB]    = useState(m.status === 'finished' ? String(m.score_b) : '0')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(m.status === 'finished')
  const [saveError, setSaveError] = useState('')

  // Keep inputs in sync when match data refreshes
  useEffect(() => {
    if (m.status === 'finished') {
      setScoreA(String(m.score_a)); setScoreB(String(m.score_b)); setSaved(true)
    }
  }, [m.score_a, m.score_b, m.status])

  async function save() {
    if (scoreA === '' || scoreB === '') return
    setSaving(true); setSaveError('')
    try {
      await setResult(m.id, { score_a: parseInt(scoreA), score_b: parseInt(scoreB) })
      setSaved(true)
      await onRefresh()
    } catch (e) {
      setSaveError(e.message)
    } finally { setSaving(false) }
  }

  // Unfinished match: always saveable (0-0 is a valid result).
  // Finished match: dirty when the displayed score differs from the saved score.
  const dirty = m.status !== 'finished'
             || scoreA !== String(m.score_a)
             || scoreB !== String(m.score_b)

  const nameA = teamMap[m.team_a_id]?.name ?? '—'
  const nameB = teamMap[m.team_b_id]?.name ?? '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
        padding: '6px 10px', borderRadius: 8,
        background: saved && !dirty ? 'var(--color-surface-2)' : 'var(--color-surface)',
        border: `1px solid ${saveError ? 'var(--color-danger)' : dirty ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
        <span style={{ flex: 1, fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</span>
        <input type="number" min="0" value={scoreA} onChange={e => { setScoreA(e.target.value); setSaved(false); setSaveError('') }}
          style={{ ...inputStyle, width: 44, textAlign: 'center', padding: '4px 6px', fontSize: 13 }} placeholder="—" />
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>–</span>
        <input type="number" min="0" value={scoreB} onChange={e => { setScoreB(e.target.value); setSaved(false); setSaveError('') }}
          style={{ ...inputStyle, width: 44, textAlign: 'center', padding: '4px 6px', fontSize: 13 }} placeholder="—" />
        <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</span>
        <button onClick={save} disabled={saving || scoreA === '' || scoreB === '' || !dirty}
          style={{ padding: '4px 12px', borderRadius: 7, fontSize: 12, border: 'none', fontFamily: 'inherit',
            fontWeight: 600, cursor: (saving || scoreA === '' || scoreB === '' || !dirty) ? 'default' : 'pointer',
            background: dirty ? 'var(--color-primary)' : 'var(--color-surface)',
            color: dirty ? '#fff' : 'var(--color-text-muted)',
            opacity: (saving || scoreA === '' || scoreB === '' || !dirty) ? 0.6 : 1, minWidth: 52 }}>
          {saving ? '…' : saved && !dirty ? 'Opgeslagen' : 'Opslaan'}
        </button>
      </div>
      {saveError && <div style={{ fontSize: 11, color: 'var(--color-danger)', paddingLeft: 10 }}>{saveError}</div>}
    </div>
  )
}

/* ── Main tab ── */
export default function MatchesTab({ tid, tournament, pools, teams: teamsFromParent, stage }) {
  const active          = tournament
  const structureLocked = stage !== 'inregel'
  const canScore        = stage === 'productie'

  const [matches,    setMatches]    = useState([])
  const [localTeams, setLocalTeams] = useState([])
  const [fields,     setFields]     = useState([])
  const [snapshots,  setSnapshots]  = useState([])
  const [snapSaving, setSnapSaving] = useState(null)
  const [genMsg,     setGenMsg]     = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)

  async function load() {
    if (!tid) return
    const [m, t, f] = await Promise.all([
      getMatches(tid).catch(() => []),
      getTeams(tid).catch(() => []),
      getFields(tid).catch(() => []),
    ])
    setMatches(m); setLocalTeams(t); setFields(f)
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

  async function handleGenerateSchedule(clearExisting) {
    setGenLoading(true); setGenMsg('')
    try {
      const result = await generateSchedule(tid, clearExisting)
      await load()
      setGenMsg(`${result?.created ?? '?'} wedstrijden aangemaakt`)
    } catch (e) { setGenMsg(`Fout: ${e.message}`) }
    finally { setGenLoading(false) }
  }

  async function handleGenerateKnockout() {
    setGenLoading(true); setGenMsg('')
    try {
      await generateKnockout(tid)
      await load()
      setGenMsg('Knock-out ronde aangemaakt')
    } catch (e) { setGenMsg(`Fout: ${e.message}`) }
    finally { setGenLoading(false) }
  }

  const cardProps = { teamMap, fieldMap, fields, canScore, onRefresh: load, structureLocked }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Schema genereren — alleen in inregel */}
      {!structureLocked && (
        <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>SCHEMA GENEREREN</div>
          {poolMatches.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 8 }}>
                Er zijn al {poolMatches.length} wedstrijden. Opnieuw genereren verwijdert deze.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleGenerateSchedule(true)} disabled={genLoading}
                  style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                    background: 'var(--color-danger)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: genLoading ? 0.6 : 1 }}>
                  {genLoading ? '…' : 'Vervang schema'}
                </button>
                <button onClick={() => handleGenerateSchedule(false)} disabled={genLoading}
                  style={{ ...ghostBtn, fontSize: 12, opacity: genLoading ? 0.6 : 1 }}>
                  {genLoading ? '…' : 'Voeg toe'}
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => handleGenerateSchedule(false)} disabled={genLoading}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: genLoading ? 0.6 : 1 }}>
              {genLoading ? 'Genereren…' : 'Genereer schema'}
            </button>
          )}
          {genMsg && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>{genMsg}</div>}

          {active?.knockout_type !== 'none' && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
              <button onClick={handleGenerateKnockout} disabled={genLoading}
                style={{ fontSize: 13, padding: '7px 14px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                  background: 'var(--color-warning)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: genLoading ? 0.6 : 1 }}>
                Genereer knock-out ronde
              </button>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>Op basis van huidige stand</span>
            </div>
          )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px' }}>
                  {roundMatches.map(m => (
                    <ScoreRow key={m.id} m={m} teamMap={teamMap} onRefresh={load} />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px' }}>
                {matches.filter(m => m.round == null && m.match_type !== 'ko').map(m => (
                  <ScoreRow key={m.id} m={m} teamMap={teamMap} onRefresh={load} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wedstrijden overzicht (per poule) */}
      {canScore && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.07em',
          textTransform: 'uppercase', paddingTop: 4, borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
          Overzicht per poule
        </div>
      )}
      {(pools ?? []).length > 0 ? (
        <>
          {(pools ?? []).map(p => (
            <div key={p.id}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '4px 0 6px', borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
                {p.name}
                <span style={{ fontWeight: 400, marginLeft: 6 }}>({(matchesByPool[p.id] ?? []).length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(matchesByPool[p.id] ?? []).length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Geen wedstrijden</p>
                  : (matchesByPool[p.id] ?? []).map(m => <MatchCard key={m.id} m={m} {...cardProps} />)
                }
              </div>
            </div>
          ))}
          {unmapped.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '4px 0 6px', borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
                Overig
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unmapped.map(m => <MatchCard key={m.id} m={m} {...cardProps} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {poolMatches.map(m => <MatchCard key={m.id} m={m} {...cardProps} />)}
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
