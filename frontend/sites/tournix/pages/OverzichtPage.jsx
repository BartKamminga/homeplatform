import { useState, useEffect } from 'react'
import { getStandings, getSnapshots, getSnapshot, getMatches, getTeams, getPools, getClubs, getPhases, getPhaseStandings } from '../api.js'

export default function OverzichtPage({ onTab, isAdmin, tournament: active }) {
  const [standings,     setStandings]     = useState([])
  const [snapshots,     setSnapshots]     = useState([])
  const [viewRound,     setViewRound]     = useState(null)
  const [error,         setError]         = useState('')
  const [matches,       setMatches]       = useState([])
  const [teams,         setTeams]         = useState([])
  const [pools,         setPools]         = useState([])
  const [clubs,         setClubs]         = useState([])
  const [phases,        setPhases]        = useState([])
  const [phaseStandings, setPhaseStandings] = useState({})
  const [simOpen,       setSimOpen]       = useState(false)
  const [simResults,    setSimResults]    = useState(null)
  const [simRunning,    setSimRunning]    = useState(false)

  useEffect(() => {
    getClubs().then(setClubs).catch(() => {})
  }, [])

  useEffect(() => {
    setViewRound(null); setSimOpen(false); setSimResults(null)
    setStandings([]); setSnapshots([]); setMatches([]); setTeams([]); setPools([])
    setPhases([]); setPhaseStandings({})
    if (!active?.id) return
    getStandings(active.id).then(setStandings).catch(() => {})
    getSnapshots(active.id).then(setSnapshots).catch(() => {})
    getMatches(active.id).then(setMatches).catch(() => {})
    getTeams(active.id).then(setTeams).catch(() => {})
    getPools(active.id).then(setPools).catch(() => {})
    getPhases(active.id).then(async ps => {
      setPhases(ps)
      const all = {}
      await Promise.all(ps.filter(p => p.phase_type === 'pool' && p.match_count > 0).map(async p => {
        const s = await getPhaseStandings(p.id).catch(() => [])
        all[p.id] = s
      }))
      setPhaseStandings(all)
    }).catch(() => {})
  }, [active?.id])

  // Load snapshot or live standings when viewRound changes
  useEffect(() => {
    if (!active) return
    if (viewRound === null) {
      getStandings(active.id).then(setStandings).catch(() => {})
    } else {
      getSnapshot(active.id, viewRound)
        .then(snap => { if (snap?.standings) setStandings(snap.standings) })
        .catch(() => {})
    }
  }, [viewRound, active?.id])

  function runMonteCarlo(currentStandings, pendingMatches, N = 10000) {
    const n = currentStandings.length
    if (n === 0) return []

    const posCount = {}
    currentStandings.forEach(s => { posCount[s.id] = Array(n).fill(0) })

    for (let sim = 0; sim < N; sim++) {
      const pts = {}, gf = {}, ga = {}
      currentStandings.forEach(s => { pts[s.id] = s.pts; gf[s.id] = s.gf; ga[s.id] = s.ga })

      for (const m of pendingMatches) {
        if (!m.team_a_id || !m.team_b_id) continue
        const r = Math.random()
        let sA, sB
        if (r < 0.4) {
          sA = 1 + Math.floor(Math.random() * 3)
          sB = Math.floor(Math.random() * sA)
        } else if (r < 0.65) {
          sA = sB = Math.floor(Math.random() * 3)
        } else {
          sB = 1 + Math.floor(Math.random() * 3)
          sA = Math.floor(Math.random() * sB)
        }
        if (pts[m.team_a_id] !== undefined) { gf[m.team_a_id] += sA; ga[m.team_a_id] += sB }
        if (pts[m.team_b_id] !== undefined) { gf[m.team_b_id] += sB; ga[m.team_b_id] += sA }
        if (sA > sB) { if (pts[m.team_a_id] !== undefined) pts[m.team_a_id] += 3 }
        else if (sA === sB) {
          if (pts[m.team_a_id] !== undefined) pts[m.team_a_id] += 1
          if (pts[m.team_b_id] !== undefined) pts[m.team_b_id] += 1
        } else { if (pts[m.team_b_id] !== undefined) pts[m.team_b_id] += 3 }
      }

      const sorted = [...currentStandings].sort((a, b) => {
        const pd = (pts[b.id]||0) - (pts[a.id]||0)
        if (pd !== 0) return pd
        const gda = (gf[a.id]||0) - (ga[a.id]||0)
        const gdb = (gf[b.id]||0) - (ga[b.id]||0)
        if (gdb !== gda) return gdb - gda
        return (gf[b.id]||0) - (gf[a.id]||0)
      })
      sorted.forEach((t, i) => { if (posCount[t.id]) posCount[t.id][i]++ })
    }

    return currentStandings.map(t => ({
      id: t.id,
      name: t.name,
      probs: posCount[t.id].map(c => Math.round(c / N * 100)),
    }))
  }

  if (error) return <p style={err}>{error}</p>

  if (!active) return (
    <div style={empty}>
      <span style={{ fontSize: 48 }}>🏆</span>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginTop: 12 }}>
        Geen actief toernooi geselecteerd.
      </p>
      <button onClick={() => onTab('beheer')} style={btn}>Naar beheer</button>
    </div>
  )

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Test-modus banner (alleen admin) */}
      {active?.stage === 'test' && isAdmin && (
        <div style={{ background: 'var(--color-warning)', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
          Test-modus — alleen zichtbaar voor admins
        </div>
      )}

      {/* Banner */}
      <div style={{
        background: 'var(--color-primary)', borderRadius: 14,
        padding: '18px 20px', color: '#fff', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {active.status === 'active' ? 'Actief toernooi' : active.status === 'finished' ? 'Afgelopen' : 'Concept'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{active.name}</div>
        {(active.location_club_id || active.location) && (
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {active.location_club_id
              ? clubs.find(c => c.id === active.location_club_id)?.name ?? active.location
              : active.location}
          </div>
        )}
        {active.date && (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {new Date(active.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        )}
      </div>

      {/* Poule-indeling */}
      {pools.length > 0 && (() => {
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
        return (
          <div style={{ marginBottom: 24 }}>
            <h2 style={sectionTitle}>Poule-indeling</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {pools.map(p => {
                const poolTeams = teams.filter(t => t.pool_id === p.id)
                return (
                  <div key={p.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 8 }}>
                      {p.name}
                    </div>
                    {poolTeams.length === 0
                      ? <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen teams</div>
                      : poolTeams.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            {t.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
                            <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{t.name}</span>
                          </div>
                        ))
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Stand */}
      <>
        <h2 style={sectionTitle}>Stand</h2>

        {/* Time travel: round selector */}
        {snapshots.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setViewRound(null)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, border: viewRound === null ? 'none' : '1px solid var(--color-border)', background: viewRound === null ? 'var(--color-primary)' : 'transparent', color: viewRound === null ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Live
            </button>
            {snapshots.map(s => (
              <button
                key={s.round}
                onClick={() => setViewRound(s.round)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, border: viewRound === s.round ? 'none' : '1px solid var(--color-border)', background: viewRound === s.round ? 'var(--color-primary)' : 'transparent', color: viewRound === s.round ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Ronde {s.round}
              </button>
            ))}
          </div>
        )}

        {standings.length > 0 ? (() => {
          const hasPoules = standings.some(s => s.pool_id)
          const pouleGroups = hasPoules
            ? Object.values(standings.reduce((acc, s) => {
                const key = s.pool_id || '__none__'
                if (!acc[key]) acc[key] = { name: s.pool_name || 'Zonder poule', rows: [] }
                acc[key].rows.push(s)
                return acc
              }, {}))
            : null

          const StandingsTable = ({ rows }) => (
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, overflow: 'hidden', marginBottom: 20,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px', gap: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <span>#</span><span>Team</span><span style={{ textAlign: 'center' }}>W</span><span style={{ textAlign: 'center' }}>G</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'center' }}>D</span><span style={{ textAlign: 'right' }}>Pts</span>
              </div>
              {rows.map((row, i) => (
                <div key={row.id} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px',
                  gap: 8, padding: '10px 12px', fontSize: 13, alignItems: 'center',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{i + 1}</span>
                  <span style={{ fontWeight: 500 }}>{row.name}</span>
                  <span style={{ textAlign: 'center' }}>{row.won}</span>
                  <span style={{ textAlign: 'center' }}>{row.draw}</span>
                  <span style={{ textAlign: 'center' }}>{row.lost}</span>
                  <span style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{row.gf}-{row.ga}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{row.pts}</span>
                </div>
              ))}
            </div>
          )

          if (hasPoules) {
            return pouleGroups.map(group => (
              <div key={group.name}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {group.name}
                </div>
                <StandingsTable rows={group.rows} />
              </div>
            ))
          }
          return <StandingsTable rows={standings} />
        })() : (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Stand verschijnt zodra er wedstrijden zijn gespeeld.
          </p>
        )}

        {/* Monte Carlo simulation */}
        {matches.filter(m => m.status !== 'finished' && m.match_type === 'pool').length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button onClick={() => {
              if (simOpen) { setSimOpen(false); setSimResults(null); return }
              setSimOpen(true)
              setSimRunning(true)
              const pending = matches.filter(m => m.status !== 'finished' && m.match_type === 'pool')
              setTimeout(() => {
                const results = runMonteCarlo(standings, pending, 10000)
                setSimResults(results)
                setSimRunning(false)
              }, 10)
            }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--color-border)',
              background: simOpen ? 'var(--color-primary)' : 'var(--color-surface)',
              color: simOpen ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {simOpen ? 'Verberg simulatie' : '⚡ Simuleer kansen'}
            </button>

            {simOpen && (
              <div style={{ marginTop: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Kansen op eindpositie — 10.000 simulaties van nog te spelen wedstrijden
                </div>
                {simRunning ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Berekenen…</div>
                ) : simResults && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Team</th>
                          {simResults[0].probs.map((_, i) => (
                            <th key={i} style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', minWidth: 36 }}>{i+1}e</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {simResults.map(row => (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.name}</td>
                            {row.probs.map((p, i) => (
                              <td key={i} style={{ padding: '6px 8px', textAlign: 'center',
                                background: p >= 50 ? 'var(--color-primary-light, #ffe0e8)' :
                                            p >= 20 ? 'var(--color-surface-2)' : 'transparent',
                                color: p > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                                fontWeight: p >= 40 ? 700 : 400 }}>
                                {p > 0 ? `${p}%` : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </>

      {/* Knock-out bracket (alleen originele KO, niet fase-KO) */}
      {(() => {
        const koMatches = matches.filter(m => m.match_type === 'ko' && !m.phase_id)
        if (!koMatches.length) return null
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
        return (
          <div style={{ marginTop: 24 }}>
            <h2 style={sectionTitle}>Knock-out</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {koMatches.map(m => {
                const ta = teamMap[m.team_a_id]
                const tb = teamMap[m.team_b_id]
                const done = m.status === 'finished'
                const winA = done && m.score_a > m.score_b
                const winB = done && m.score_b > m.score_a
                return (
                  <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontWeight: winA ? 700 : 500, color: winB ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{ta?.name ?? '—'}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, minWidth: 60, textAlign: 'center', color: done ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {done ? `${m.score_a}–${m.score_b}` : 'vs'}
                      </span>
                      <span style={{ flex: 1, textAlign: 'right', fontWeight: winB ? 700 : 500, color: winA ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{tb?.name ?? '—'}</span>
                    </div>
                    {done && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'center' }}>
                        Winnaar: {winA ? ta?.name : tb?.name}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Fases (follow-up brackets) */}
      {phases.length > 0 && phases.map(phase => {
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
        const phaseMatches = matches.filter(m => m.phase_id === phase.id)
        const ps = phaseStandings[phase.id] || []

        return (
          <div key={phase.id} style={{ marginTop: 24 }}>
            <h2 style={sectionTitle}>{phase.name}</h2>

            {/* Round-robin standings */}
            {phase.phase_type === 'pool' && ps.length > 0 && (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px', gap: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <span>#</span><span>Team</span><span style={{ textAlign: 'center' }}>W</span><span style={{ textAlign: 'center' }}>G</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'center' }}>D</span><span style={{ textAlign: 'right' }}>Pts</span>
                </div>
                {ps.map((row, i) => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px', gap: 8, padding: '10px 12px', fontSize: 13, alignItems: 'center', borderBottom: i < ps.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{i + 1}</span>
                    <span style={{ fontWeight: 500 }}>{row.name}</span>
                    <span style={{ textAlign: 'center' }}>{row.w}</span>
                    <span style={{ textAlign: 'center' }}>{row.d}</span>
                    <span style={{ textAlign: 'center' }}>{row.l}</span>
                    <span style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{row.gf}-{row.ga}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{row.pts}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Matches for this phase */}
            {phaseMatches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {phaseMatches.map(m => {
                  const ta = teamMap[m.team_a_id]
                  const tb = teamMap[m.team_b_id]
                  const done = m.status === 'finished'
                  const winA = done && m.score_a > m.score_b
                  const winB = done && m.score_b > m.score_a
                  return (
                    <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: winA ? 700 : 500, color: winB ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{ta?.name ?? '—'}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, minWidth: 60, textAlign: 'center' }}>
                          {done ? `${m.score_a}–${m.score_b}` : <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>vs</span>}
                        </span>
                        <span style={{ flex: 1, textAlign: 'right', fontWeight: winB ? 700 : 500, color: winA ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{tb?.name ?? '—'}</span>
                      </div>
                      {done && m.shootout_winner && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'center' }}>
                          PSO — {m.shootout_winner === 'a' ? ta?.name : tb?.name}
                        </div>
                      )}
                      {m.round && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 2 }}>Ronde {m.round}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const sectionTitle = { fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }
const empty = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }
const err   = { color: 'var(--color-danger)', padding: 20, fontSize: 13 }
const btn   = {
  marginTop: 16, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500,
  background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
