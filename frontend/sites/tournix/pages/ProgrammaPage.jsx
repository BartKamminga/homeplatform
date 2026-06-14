import { useState, useEffect } from 'react'
import { getMatches, getTeams, getFields, getPools, setResult, getPhases } from '../api.js'

const STATUS_LABEL = { scheduled: 'Gepland', playing: 'Bezig', finished: 'Klaar' }
const STATUS_COLOR = { scheduled: 'var(--color-text-muted)', playing: '#f59e0b', finished: '#22c55e' }

function resolveTeam(teamId, sourceId, takes, teamMap, matchMap) {
  if (teamId) return teamMap[teamId] ?? null
  if (!sourceId) return null
  const src = matchMap?.[sourceId]
  if (!src) return null
  const label = takes === 'loser' ? 'Verl.' : 'Win.'
  const tA = src.team_a_id ? (teamMap[src.team_a_id]?.name ?? '?') : '?'
  const tB = src.team_b_id ? (teamMap[src.team_b_id]?.name ?? '?') : '?'
  return { name: `${label} ${tA}–${tB}`, is_placeholder: true }
}

export default function ProgrammaPage({ stage, tournament }) {
  const [matches,  setMatches]  = useState([])
  const [teams,    setTeams]    = useState({})
  const [fields,   setFields]   = useState({})
  const [pools,    setPools]    = useState([])
  const [phases,   setPhases]   = useState([])
  const [viewMode, setViewMode] = useState('ronde')  // 'ronde' | 'poule'
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Simulation state for test mode
  const [simScores,   setSimScores]   = useState({})   // { [matchId]: { a: number, b: number } }
  const [simEdit,     setSimEdit]     = useState(null)  // matchId currently being edited
  const [simInputA,   setSimInputA]   = useState('')
  const [simInputB,   setSimInputB]   = useState('')

  // Real score editing state for productie mode
  const [scoreEdit,      setScoreEdit]      = useState(null)
  const [scoreA,         setScoreA]         = useState('')
  const [scoreB,         setScoreB]         = useState('')
  const [shootoutWinner, setShootoutWinner] = useState(null)
  const [savingScore,    setSavingScore]    = useState(null)
  const [saveError,      setSaveError]      = useState('')

  const isTest = stage === 'test'

  useEffect(() => {
    setMatches([]); setTeams({}); setFields({}); setPools([]); setPhases([])
    if (!tournament?.id) return
    setLoading(true)
    Promise.all([getMatches(tournament.id), getTeams(tournament.id), getFields(tournament.id), getPools(tournament.id), getPhases(tournament.id)])
      .then(([m, t, f, p, ph]) => {
        setMatches(m)
        setTeams(Object.fromEntries(t.map(x => [x.id, x])))
        setFields(Object.fromEntries(f.map(x => [x.id, x])))
        setPools(p)
        setPhases(ph)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tournament?.id])

  // Reset sim state when leaving test mode
  useEffect(() => {
    if (!isTest) {
      setSimScores({})
      setSimEdit(null)
    }
  }, [isTest])

  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))
  const nonPhaseMatches = matches.filter(m => !m.phase_id && m.status !== 'finished')

  const groupedByRonde = nonPhaseMatches.reduce((acc, m) => {
    const key = m.match_type === 'ko'
      ? 'Knock-out'
      : m.round != null ? `Ronde ${m.round}` : 'Overig'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  // Group pool matches by pool; KO matches in their own section (exclude phase matches)
  const groupedByPoule = (() => {
    const result = {}
    for (const p of pools) {
      const poolMatches = nonPhaseMatches.filter(m =>
        m.match_type !== 'ko' &&
        teams[m.team_a_id]?.pool_id === p.id &&
        teams[m.team_b_id]?.pool_id === p.id
      )
      if (poolMatches.length > 0) result[p.name] = poolMatches
    }
    const unassigned = nonPhaseMatches.filter(m =>
      m.match_type !== 'ko' &&
      pools.length > 0 &&
      !(teams[m.team_a_id]?.pool_id && teams[m.team_a_id]?.pool_id === teams[m.team_b_id]?.pool_id)
    )
    if (unassigned.length > 0) result['Overig'] = unassigned
    const ko = nonPhaseMatches.filter(m => m.match_type === 'ko')
    if (ko.length > 0) result['Knock-out'] = ko
    return result
  })()

  const grouped = viewMode === 'poule' && pools.length > 0 ? groupedByPoule : groupedByRonde

  function openSimEdit(mid) {
    const existing = simScores[mid]
    setSimEdit(mid)
    setSimInputA(existing ? String(existing.a) : '')
    setSimInputB(existing ? String(existing.b) : '')
  }

  function confirmSimScore(mid) {
    const a = parseInt(simInputA)
    const b = parseInt(simInputB)
    if (!isNaN(a) && !isNaN(b) && a >= 0 && b >= 0) {
      setSimScores(prev => ({ ...prev, [mid]: { a, b } }))
    }
    setSimEdit(null)
  }

  function clearSimScore(mid) {
    setSimScores(prev => { const n = { ...prev }; delete n[mid]; return n })
    setSimEdit(null)
  }

  async function saveRealResult(mid) {
    if (scoreA === '' || scoreB === '') return
    setSavingScore(mid)
    try {
      const match = matches.find(m => m.id === mid)
      const data = { score_a: parseInt(scoreA), score_b: parseInt(scoreB) }
      if (match?.match_type === 'ko') data.shootout_winner = shootoutWinner
      await setResult(mid, data)
      setScoreEdit(null); setScoreA(''); setScoreB('')
      setShootoutWinner(null)
      const updated = await getMatches(tournament.id)
      setMatches(updated)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSavingScore(null)
    }
  }

  if (!tournament) return <p style={muted}>Selecteer een toernooi in de header.</p>
  if (loading) return <p style={muted}>Laden…</p>
  if (error)   return <p style={err}>{error}</p>

  const hasUpcomingPhaseMatches = phases.some(p =>
    matches.some(m => m.phase_id === p.id && m.status !== 'finished')
  )

  if (Object.keys(grouped).length === 0 && !hasUpcomingPhaseMatches) return (
    <p style={muted}>Geen aankomende wedstrijden.</p>
  )

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* View toggle — alleen tonen als er poules zijn */}
      {pools.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[['ronde', 'Per ronde'], ['poule', 'Per poule']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer',
              border: `1px solid ${viewMode === mode ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: viewMode === mode ? 'var(--color-primary)' : 'var(--color-surface)',
              color: viewMode === mode ? '#fff' : 'var(--color-text)',
              fontWeight: viewMode === mode ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* Simulation banner */}
      {isTest && (
        <div style={{
          background: 'var(--color-warning)', color: '#fff', borderRadius: 10,
          padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Simulatiemodus — scores worden NIET opgeslagen
          </span>
        </div>
      )}

      {Object.entries(grouped).map(([round, list]) => (
        <div key={round} style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle}>{round}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(m => {
              const sim = simScores[m.id]
              const hasSimScore = !!sim
              const isSimEditing = simEdit === m.id
              const isRealEditing = scoreEdit === m.id

              // Determine displayed score
              const showFinished = m.status === 'finished' && !isTest
              const showSim = isTest && hasSimScore

              return (
                <div key={m.id} style={{
                  background: isTest && hasSimScore ? 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))' : 'var(--color-surface)',
                  border: `1px solid ${isTest && hasSimScore ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  borderRadius: 12, padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                      {resolveTeam(m.team_a_id, m.source_match_a_id, m.source_a_takes, teams, matchMap)?.name ?? '—'}
                    </div>
                    <div style={{ minWidth: 60, textAlign: 'center' }}>
                      {showFinished
                        ? <span style={{ fontSize: 16, fontWeight: 700 }}>
                            {m.score_a} – {m.score_b}
                            {m.shootout_winner && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400, display: 'block' }}>PSO</span>}
                          </span>
                        : showSim
                          ? <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-warning)' }}>{sim.a} – {sim.b}</span>
                          : <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>vs</span>
                      }
                    </div>
                    <div style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>
                      {resolveTeam(m.team_b_id, m.source_match_b_id, m.source_b_takes, teams, matchMap)?.name ?? '—'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {m.scheduled_at && (
                      <span>{new Date(m.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {m.field_id && fields[m.field_id] && (
                      <span>{fields[m.field_id].name}</span>
                    )}
                    <span style={{ color: STATUS_COLOR[m.status] }}>{STATUS_LABEL[m.status]}</span>
                    {isTest && hasSimScore && (
                      <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Simulatie</span>
                    )}
                  </div>

                  {/* Test mode: simulated score input */}
                  {isTest && isSimEditing && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input
                        type="number" min="0" value={simInputA}
                        onChange={e => setSimInputA(e.target.value)}
                        style={{ ...scoreInput, width: 52 }} placeholder="0"
                      />
                      <span>–</span>
                      <input
                        type="number" min="0" value={simInputB}
                        onChange={e => setSimInputB(e.target.value)}
                        style={{ ...scoreInput, width: 52 }} placeholder="0"
                      />
                      <button onClick={() => confirmSimScore(m.id)} style={primaryBtn}>Simuleer</button>
                      {hasSimScore && <button onClick={() => clearSimScore(m.id)} style={ghostBtn}>Reset</button>}
                      <button onClick={() => setSimEdit(null)} style={ghostBtn}>Annuleer</button>
                    </div>
                  )}
                  {isTest && !isSimEditing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        onClick={() => openSimEdit(m.id)}
                        style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px' }}
                      >
                        {hasSimScore ? 'Wijzig simulatie' : 'Simuleer score'}
                      </button>
                    </div>
                  )}

                  {/* Productie mode: real score input */}
                  {!isTest && stage === 'productie' && isRealEditing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="number" min="0" value={scoreA} onChange={e => { setScoreA(e.target.value); setSaveError('') }} style={{ ...scoreInput, width: 52 }} placeholder="0" autoFocus />
                        <span>–</span>
                        <input type="number" min="0" value={scoreB} onChange={e => { setScoreB(e.target.value); setSaveError('') }} style={{ ...scoreInput, width: 52 }} placeholder="0" />
                        <button
                          onClick={() => saveRealResult(m.id)}
                          disabled={savingScore === m.id || scoreA === '' || scoreB === ''}
                          style={{ ...primaryBtn, opacity: (savingScore === m.id || scoreA === '' || scoreB === '') ? 0.5 : 1 }}
                        >
                          {savingScore === m.id ? 'Opslaan…' : 'Opslaan'}
                        </button>
                        <button onClick={() => { setScoreEdit(null); setShootoutWinner(null); setSaveError('') }} style={ghostBtn}>Annuleer</button>
                      </div>
                      {m.match_type === 'ko' && scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Strafschoppen gewonnen door:</span>
                          {[['a', teams[m.team_a_id]?.name], ['b', teams[m.team_b_id]?.name]].map(([key, name]) => (
                            <button key={key} type="button" onClick={() => setShootoutWinner(prev => prev === key ? null : key)}
                              style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                                border: `1px solid ${shootoutWinner === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                background: shootoutWinner === key ? 'var(--color-primary)' : 'transparent',
                                color: shootoutWinner === key ? '#fff' : 'var(--color-text-muted)', fontWeight: shootoutWinner === key ? 600 : 400 }}>
                              {name ?? '—'}
                            </button>
                          ))}
                        </div>
                      )}
                      {saveError && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{saveError}</div>}
                    </div>
                  )}
                  {!isTest && stage === 'productie' && !isRealEditing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        onClick={() => {
                          setScoreEdit(m.id)
                          setScoreA(m.status === 'finished' ? String(m.score_a) : '0')
                          setScoreB(m.status === 'finished' ? String(m.score_b) : '0')
                          setShootoutWinner(m.shootout_winner ?? null)
                          setSaveError('')
                        }}
                        style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px' }}
                      >
                        {m.status === 'finished' ? 'Wijzig uitslag' : 'Uitslag invoeren'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Fase-wedstrijden */}
      {phases.filter(p => p.match_count > 0).map(phase => {
        const phaseMatches = matches.filter(m => m.phase_id === phase.id && m.status !== 'finished')
        if (!phaseMatches.length) return null
        const byRound = phaseMatches.reduce((acc, m) => {
          const key = m.round != null ? `${phase.name} — Ronde ${m.round}` : phase.name
          if (!acc[key]) acc[key] = []
          acc[key].push(m)
          return acc
        }, {})
        return Object.entries(byRound).map(([roundKey, roundList]) => (
          <div key={roundKey} style={{ marginBottom: 24 }}>
            <h2 style={sectionTitle}>{roundKey}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roundList.map(m => {
                const isRealEditing = scoreEdit === m.id
                const showFinished = m.status === 'finished' && !isTest
                return (
                  <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{resolveTeam(m.team_a_id, m.source_match_a_id, m.source_a_takes, teams, matchMap)?.name ?? '—'}</div>
                      <div style={{ minWidth: 60, textAlign: 'center' }}>
                        {showFinished
                          ? <span style={{ fontSize: 16, fontWeight: 700 }}>
                              {m.score_a} – {m.score_b}
                              {m.shootout_winner && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400, display: 'block' }}>PSO</span>}
                            </span>
                          : <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>vs</span>
                        }
                      </div>
                      <div style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>{resolveTeam(m.team_b_id, m.source_match_b_id, m.source_b_takes, teams, matchMap)?.name ?? '—'}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {m.scheduled_at && <span>{new Date(m.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>}
                      {m.field_id && fields[m.field_id] && <span>{fields[m.field_id].name}</span>}
                      <span style={{ color: STATUS_COLOR[m.status] }}>{STATUS_LABEL[m.status]}</span>
                    </div>
                    {!isTest && stage === 'productie' && isRealEditing && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="number" min="0" value={scoreA} onChange={e => { setScoreA(e.target.value); setSaveError('') }} style={{ ...scoreInput, width: 52 }} placeholder="0" autoFocus />
                          <span>–</span>
                          <input type="number" min="0" value={scoreB} onChange={e => { setScoreB(e.target.value); setSaveError('') }} style={{ ...scoreInput, width: 52 }} placeholder="0" />
                          <button onClick={() => saveRealResult(m.id)} disabled={savingScore === m.id || scoreA === '' || scoreB === ''} style={{ ...primaryBtn, opacity: (savingScore === m.id || scoreA === '' || scoreB === '') ? 0.5 : 1 }}>
                            {savingScore === m.id ? 'Opslaan…' : 'Opslaan'}
                          </button>
                          <button onClick={() => { setScoreEdit(null); setShootoutWinner(null); setSaveError('') }} style={ghostBtn}>Annuleer</button>
                        </div>
                        {m.match_type === 'ko' && scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Strafschoppen gewonnen door:</span>
                            {[['a', teams[m.team_a_id]?.name], ['b', teams[m.team_b_id]?.name]].map(([key, name]) => (
                              <button key={key} type="button" onClick={() => setShootoutWinner(prev => prev === key ? null : key)}
                                style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                                  border: `1px solid ${shootoutWinner === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                  background: shootoutWinner === key ? 'var(--color-primary)' : 'transparent',
                                  color: shootoutWinner === key ? '#fff' : 'var(--color-text-muted)', fontWeight: shootoutWinner === key ? 600 : 400 }}>
                                {name ?? '—'}
                              </button>
                            ))}
                          </div>
                        )}
                        {saveError && <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{saveError}</div>}
                      </div>
                    )}
                    {!isTest && stage === 'productie' && !isRealEditing && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                        <button onClick={() => { setScoreEdit(m.id); setScoreA(m.status === 'finished' ? String(m.score_a) : '0'); setScoreB(m.status === 'finished' ? String(m.score_b) : '0'); setShootoutWinner(m.shootout_winner ?? null); setSaveError('') }}
                          style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px' }}>
                          {m.status === 'finished' ? 'Wijzig uitslag' : 'Uitslag invoeren'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      })}
    </div>
  )
}

const sectionTitle = { fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }
const muted     = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
const err       = { padding: 24, fontSize: 13, color: 'var(--color-danger)' }
const scoreInput = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none', textAlign: 'center' }
const primaryBtn = { padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn   = { padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }
