import { useState, useEffect } from 'react'
import { getStandings, getSnapshots, getSnapshot, getMatches, getTeams, getPools, getClubs, getPhases, getPhaseStandings } from '../api.js'
import { resolveTeam } from '../helpers.js'

/* ── Poule card met live-voorspelling ── */
function PoolCard({ poolName, rows, poolMatches, teamMap }) {
  const [preds, setPreds] = useState({})

  const pts = {}, ds = {}
  rows.forEach(r => { pts[r.id] = r.pts; ds[r.id] = r.gf - r.ga })

  const pending = poolMatches.filter(m => m.status !== 'finished' && m.team_a_id && m.team_b_id)
  for (const m of pending) {
    const p = preds[m.id]
    if (!p) continue
    if (p === 'W') pts[m.team_a_id] = (pts[m.team_a_id] || 0) + 3
    else if (p === 'D') { pts[m.team_a_id] = (pts[m.team_a_id] || 0) + 1; pts[m.team_b_id] = (pts[m.team_b_id] || 0) + 1 }
    else pts[m.team_b_id] = (pts[m.team_b_id] || 0) + 3
  }

  const live = rows
    .map(r => ({ ...r, livePts: pts[r.id] || 0, liveDs: ds[r.id] || 0 }))
    .sort((a, b) => b.livePts - a.livePts || b.liveDs - a.liveDs)

  const roundMap = {}
  for (const m of pending) {
    const r = m.round ?? 0
    if (!roundMap[r]) roundMap[r] = []
    roundMap[r].push(m)
  }
  const openRounds = Object.keys(roundMap).length
  const anyPreds = Object.values(preds).some(Boolean)

  function toggle(id, side) {
    setPreds(prev => ({ ...prev, [id]: prev[id] === side ? undefined : side }))
  }
  function predictAll() {
    const next = {}
    for (const m of pending) {
      const r = Math.random()
      next[m.id] = r < 0.45 ? 'W' : r < 0.65 ? 'D' : 'L'
    }
    setPreds(next)
  }

  const WIN_BG  = 'rgba(0,0,0,0.07)'
  const WIN_ACT = 'var(--color-primary)'

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{poolName}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            {openRounds > 0 ? `nog ${openRounds} ronde${openRounds !== 1 ? 's' : ''}` : '✓ klaar'}
          </span>
        </div>
        {openRounds > 0 && (
          <div style={{ display: 'flex', gap: 5 }}>
            {anyPreds && (
              <button onClick={() => setPreds({})} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)' }}>✕</button>
            )}
            <button onClick={predictAll} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'var(--color-primary)', color: '#fff', fontStyle: 'italic' }} title="Voorspel alle wedstrijden">✦</button>
          </div>
        )}
      </div>

      {/* Standings */}
      <div style={{ padding: '6px 0' }}>
        {live.map((row, i) => (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 26px 34px', alignItems: 'center', gap: 4, padding: '4px 13px', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{i + 1}</span>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{row.livePts}</span>
            <span style={{ textAlign: 'right', fontSize: 11, color: row.liveDs > 0 ? 'var(--color-success)' : row.liveDs < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {row.liveDs > 0 ? '+' : ''}{row.liveDs}
            </span>
          </div>
        ))}
      </div>

      {/* Resterende rondes */}
      {Object.entries(roundMap).sort(([a], [b]) => Number(a) - Number(b)).map(([r, ms]) => (
        <div key={r}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '5px 13px 2px', borderTop: '1px solid var(--color-border)' }}>
            Ronde {r}
          </div>
          {ms.map(m => {
            const ta = teamMap[m.team_a_id]
            const tb = teamMap[m.team_b_id]
            const p = preds[m.id]
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', fontSize: 12, padding: '2px 8px' }}>
                <div onClick={() => toggle(m.id, 'W')} style={{ flex: 1, textAlign: 'right', padding: '4px 5px', cursor: 'pointer', borderRadius: '4px 0 0 4px', background: p === 'W' ? WIN_ACT : 'transparent', color: p === 'W' ? '#fff' : 'var(--color-text)', fontWeight: p === 'W' ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ta?.name ?? '—'}
                </div>
                <div onClick={() => toggle(m.id, 'D')} style={{ padding: '4px 5px', cursor: 'pointer', textAlign: 'center', minWidth: 24, background: p === 'D' ? WIN_ACT : WIN_BG, color: p === 'D' ? '#fff' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 10, borderRadius: 0 }}>
                  {p === 'D' ? 'G' : '–'}
                </div>
                <div onClick={() => toggle(m.id, 'L')} style={{ flex: 1, textAlign: 'left', padding: '4px 5px', cursor: 'pointer', borderRadius: '0 4px 4px 0', background: p === 'L' ? WIN_ACT : 'transparent', color: p === 'L' ? '#fff' : 'var(--color-text)', fontWeight: p === 'L' ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tb?.name ?? '—'}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

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

  useEffect(() => {
    getClubs().then(setClubs).catch(() => {})
  }, [])

  useEffect(() => {
    setViewRound(null)
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
          const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))

          if (hasPoules) {
            const pouleGroups = Object.values(standings.reduce((acc, s) => {
              const key = s.pool_id || '__none__'
              if (!acc[key]) acc[key] = { poolId: s.pool_id, name: s.pool_name || 'Zonder poule', rows: [] }
              acc[key].rows.push(s)
              return acc
            }, {}))
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                {pouleGroups.map(group => {
                  const teamIds = new Set(group.rows.map(r => r.id))
                  const poolMatches = matches.filter(m => m.match_type === 'pool' && teamIds.has(m.team_a_id) && teamIds.has(m.team_b_id))
                  return (
                    <div key={group.name} style={{ flex: '1 1 260px', maxWidth: 340 }}>
                      <PoolCard poolName={group.name} rows={group.rows} poolMatches={poolMatches} teamMap={teamMap} />
                    </div>
                  )
                })}
              </div>
            )
          }

          // Geen poules — gewone tabel
          return (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px', gap: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <span>#</span><span>Team</span><span style={{ textAlign: 'center' }}>W</span><span style={{ textAlign: 'center' }}>G</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'center' }}>D</span><span style={{ textAlign: 'right' }}>Pts</span>
              </div>
              {standings.map((row, i) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 40px', gap: 8, padding: '10px 12px', fontSize: 13, alignItems: 'center', borderBottom: i < standings.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
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
        })() : (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Stand verschijnt zodra er wedstrijden zijn gespeeld.
          </p>
        )}
      </>

      {/* Knock-out bracket (alleen originele KO, niet fase-KO) */}
      {(() => {
        const koMatches = matches.filter(m => m.match_type === 'ko' && !m.phase_id)
        if (!koMatches.length) return null
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
        const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))
        return (
          <div style={{ marginTop: 24 }}>
            <h2 style={sectionTitle}>Knock-out</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {koMatches.map(m => {
                const ta = resolveTeam(m.team_a_id, m.source_match_a_id, m.source_a_takes, teamMap, matchMap)
                const tb = resolveTeam(m.team_b_id, m.source_match_b_id, m.source_b_takes, teamMap, matchMap)
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

      {/* Vervolg-fases (hoofd-fase overgeslagen — staat al in "Stand" hierboven) */}
      {phases.filter(p => !p.is_main_phase).map(phase => {
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
        const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))
        const phaseMatches = matches.filter(m => m.phase_id === phase.id)
        const ps = phaseStandings[phase.id] || []

        // KO: groepeer per bracket_round
        const koRounds = {}
        if (phase.phase_type === 'ko') {
          for (const m of phaseMatches) {
            const r = m.bracket_round ?? 0
            if (!koRounds[r]) koRounds[r] = []
            koRounds[r].push(m)
          }
        }
        const maxKoRound = Object.keys(koRounds).length ? Math.max(...Object.keys(koRounds).map(Number)) : 0

        function koRoundLabel(r) {
          const isConsolation = (koRounds[r] || []).some(m => m.source_a_takes === 'loser' || m.source_b_takes === 'loser')
          if (r === maxKoRound) return isConsolation ? 'Troostfinale' : 'Finale'
          if (r === maxKoRound - 1) return 'Halve finales'
          if (r === maxKoRound - 2) return 'Kwartfinales'
          return `Ronde ${r}`
        }

        return (
          <div key={phase.id} style={{ marginTop: 24 }}>
            <h2 style={sectionTitle}>{phase.name}</h2>

            {/* Pool-fase standen (vervolg-poule) */}
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

            {/* Pool-fase wedstrijden */}
            {phase.phase_type === 'pool' && phaseMatches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {phaseMatches.map(m => {
                  const ta = teamMap[m.team_a_id]
                  const tb = teamMap[m.team_b_id]
                  const done = m.status === 'finished'
                  const winA = done && m.score_a > m.score_b
                  const winB = done && m.score_b > m.score_a
                  return (
                    <div key={m.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: winA ? 700 : 500, color: winB ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{ta?.name ?? '—'}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 52, textAlign: 'center', color: done ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {done ? `${m.score_a}–${m.score_b}` : 'vs'}
                        </span>
                        <span style={{ flex: 1, textAlign: 'right', fontWeight: winB ? 700 : 500, color: winA ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{tb?.name ?? '—'}</span>
                      </div>
                      {m.round && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 2 }}>Ronde {m.round}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* KO-bracket — horizontale weergave met verbindingslijntjes */}
            {phase.phase_type === 'ko' && Object.keys(koRounds).length > 0 && (() => {
              const MH = 78   // match card height
              const SH = 110  // slot height per round-1 match
              const CW = 176  // match card width
              const LW = 44   // connector zone between columns
              const HH = 26   // header row height

              const renderCard = (m, isFinal, small) => {
                const ta = resolveTeam(m.team_a_id, m.source_match_a_id, m.source_a_takes, teamMap, matchMap)
                const tb = resolveTeam(m.team_b_id, m.source_match_b_id, m.source_b_takes, teamMap, matchMap)
                const done = m.status === 'finished' && (m.team_a_id || m.team_b_id)
                const winA = done && m.score_a > m.score_b
                const winB = done && m.score_b > m.score_a
                const fs = small ? 11 : 12
                return (
                  <div style={{
                    background: 'var(--color-surface)',
                    border: `1px solid ${isFinal ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 8,
                    padding: small ? '5px 8px' : '8px 10px',
                    ...(isFinal ? { boxShadow: '0 0 0 2px var(--color-primary-light)' } : {}),
                  }}>
                    <div style={{ fontSize: fs, fontWeight: winA ? 700 : 500, color: winB ? 'var(--color-text-muted)' : 'var(--color-text)', fontStyle: ta?.is_placeholder ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ta?.name ?? '—'}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: small ? 11 : 13, fontWeight: 700, color: done ? 'var(--color-text)' : 'var(--color-text-muted)', padding: '2px 0' }}>
                      {done ? `${m.score_a} – ${m.score_b}` : 'vs'}
                    </div>
                    <div style={{ fontSize: fs, fontWeight: winB ? 700 : 500, color: winA ? 'var(--color-text-muted)' : 'var(--color-text)', fontStyle: tb?.is_placeholder ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tb?.name ?? '—'}
                    </div>
                    {done && m.shootout_winner && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 2 }}>
                        PSO — {m.shootout_winner === 'a' ? ta?.name : tb?.name}
                      </div>
                    )}
                  </div>
                )
              }

              const sorted = Object.entries(koRounds).sort(([a], [b]) => Number(a) - Number(b))
              const mainRounds = sorted
                .map(([r, ms]) => [r, ms.filter(m => m.source_a_takes !== 'loser' && m.source_b_takes !== 'loser')])
                .filter(([, ms]) => ms.length > 0)
              const consolations = sorted.flatMap(([, ms]) => ms.filter(m => m.source_a_takes === 'loser' || m.source_b_takes === 'loser'))

              const N  = mainRounds[0]?.[1].length ?? 1
              const nR = mainRounds.length
              const colH = N * SH
              const svgW = nR * CW + (nR - 1) * LW

              // Y-center of match mi in round ri, relative to bracket area top (below header)
              const cy = (ri, mi) => {
                const M = mainRounds[ri]?.[1].length ?? 1
                return (mi + 0.5) * (N / M) * SH
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ position: 'relative', width: svgW, margin: '0 auto' }}>

                    {/* SVG connector lines — drawn behind cards */}
                    <svg width={svgW} height={colH + HH}
                      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      {mainRounds.slice(0, -1).map(([r, rMatches], ri) =>
                        rMatches.map((_, mi) => {
                          const x0 = ri * (CW + LW) + CW
                          const y0 = HH + cy(ri, mi)
                          const x1 = (ri + 1) * (CW + LW)
                          const y1 = HH + cy(ri + 1, Math.floor(mi / 2))
                          const mx = x0 + LW / 2
                          return (
                            <path key={`l${r}-${mi}`}
                              d={`M${x0},${y0} H${mx} V${y1} H${x1}`}
                              fill="none" stroke="var(--color-border)" strokeWidth={1.5}
                              strokeLinecap="round" strokeLinejoin="round" />
                          )
                        })
                      )}
                    </svg>

                    {/* Column headers */}
                    <div style={{ display: 'flex', height: HH }}>
                      {mainRounds.map(([r], ri) => {
                        const rNum = Number(r)
                        const isFinalRound = rNum === maxKoRound
                        const label = isFinalRound ? 'Finale' : koRoundLabel(rNum)
                        return (
                          <div key={r} style={{ width: CW + (ri < nR - 1 ? LW : 0), flexShrink: 0 }}>
                            <div style={{ width: CW, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: `${HH}px` }}>
                              {label}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Match cards — absolutely positioned */}
                    <div style={{ position: 'relative', height: colH }}>
                      {mainRounds.map(([r, rMatches], ri) => {
                        const rNum = Number(r)
                        const isFinalRound = rNum === maxKoRound
                        return rMatches.map((m, mi) => (
                          <div key={m.id} style={{ position: 'absolute', top: cy(ri, mi) - MH / 2, left: ri * (CW + LW), width: CW }}>
                            {renderCard(m, isFinalRound, false)}
                          </div>
                        ))
                      })}
                    </div>

                  </div>

                  {/* Troostfinale — kleiner en gecentreerd */}
                  {consolations.length > 0 && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.7 }}>
                        Troostfinale
                      </div>
                      <div style={{ width: 140 }}>
                        {consolations.map(m => (
                          <div key={m.id}>{renderCard(m, false, true)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
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
