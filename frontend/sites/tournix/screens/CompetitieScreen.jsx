import { useState, useEffect } from 'react'
import { getTournamentCompetitionStandings, getCompetitionMatches, syncCompetition, deleteTournament, removeTournamentComp } from '../api.js'
import CompetitiesTab from '../beheer/CompetitiesTab.jsx'

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

function fmtScore(home, away) {
  if (home == null || away == null) return '–'
  return `${home}–${away}`
}

function fmtDate(d) {
  if (!d) return ''
  // d kan "2026-09-13" of "2026-09-13 14:00" zijn
  const parts = d.split(' ')
  return parts[0]
}

// ── Standings tabel (discovery-data) ─────────────────────────────────────────

function DiscStandingsTable({ poule }) {
  const rows = poule.standings || []
  const pending = poule.teams_pending || []

  if (rows.length === 0) {
    if (pending.length === 0) return (
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '6px 10px' }}>
        Nog geen stand
      </div>
    )
    return (
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '5px 10px 3px' }}>
          Nog geen stand — deelnemende teams:
        </div>
        {pending.map((name, i) => (
          <div key={i} style={{
            fontSize: 12, padding: '4px 10px',
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}>{name}</div>
        ))}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
          <th style={{ padding: '3px 3px 3px 8px', textAlign: 'left', width: 18 }}>#</th>
          <th style={{ padding: '3px 3px', textAlign: 'left' }}>Team</th>
          <th style={{ padding: '3px 6px', textAlign: 'center', width: 24 }}>W</th>
          <th style={{ padding: '3px 6px', textAlign: 'center', width: 24 }}>G</th>
          <th style={{ padding: '3px 6px', textAlign: 'center', width: 24 }}>V</th>
          <th style={{ padding: '3px 8px 3px 3px', textAlign: 'center', width: 30, fontWeight: 600,
            color: 'var(--color-text)' }}>Pt</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{
            borderTop: '1px solid var(--color-border)',
            background: i === 0 ? 'rgba(var(--color-primary-rgb, 46,125,50),0.06)' : 'transparent',
          }}>
            <td style={{ padding: '4px 3px 4px 8px', color: 'var(--color-text-muted)', fontSize: 11 }}>{i + 1}</td>
            <td style={{ padding: '4px 3px', maxWidth: 0, width: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontWeight: i === 0 ? 600 : 400 }}>{r.team_name}</td>
            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.won}</td>
            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.drawn}</td>
            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.lost}</td>
            <td style={{ padding: '4px 8px 4px 3px', textAlign: 'center', fontWeight: 700 }}>{r.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Competitie detail view ────────────────────────────────────────────────────

function CompetitieDetail({ comp, isAdmin, onBack }) {
  const [matchTab,    setMatchTab]    = useState('standen')
  const [matchData,   setMatchData]   = useState(null)
  const [syncing,     setSyncing]     = useState(false)
  const [syncMsg,     setSyncMsg]     = useState('')
  const [teamFilter,  setTeamFilter]  = useState('')

  useEffect(() => {
    setTeamFilter('')
    setMatchData(null)
  }, [comp.id])

  useEffect(() => {
    if (matchTab === 'wedstrijden' && matchData === null) {
      getCompetitionMatches(comp.id)
        .then(setMatchData)
        .catch(() => setMatchData({ poules: [] }))
    }
  }, [matchTab, comp.id, matchData])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await syncCompetition(comp.id)
      setSyncMsg(`✓ ${r.added} poule(s) in wachtrij${r.skipped ? `, ${r.skipped} al pending` : ''}`)
    } catch (e) {
      setSyncMsg(`Fout: ${e.message}`)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  const TABS = ['standen', 'wedstrijden']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid var(--color-border)',
          borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
          fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'inherit',
        }}>← Terug</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{comp.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {[
              comp.hockey_type === 'ZA' ? '🏒 Zaal' : comp.hockey_type === 'VE' ? '🏑 Veld' : null,
              comp.class_name,
              comp.district,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncMsg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{syncMsg}</span>}
            <button onClick={handleSync} disabled={syncing} style={{
              background: syncing ? 'var(--color-surface)' : 'var(--color-primary)',
              color: syncing ? 'var(--color-text-muted)' : '#fff',
              border: 'none', borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, cursor: syncing ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}>
              {syncing ? '⟳ Syncing…' : '🔄 Sync'}
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setMatchTab(t)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12,
            fontFamily: 'inherit', cursor: 'pointer', fontWeight: matchTab === t ? 600 : 400,
            border: `1px solid ${matchTab === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: matchTab === t ? 'var(--color-primary)' : 'var(--color-surface)',
            color: matchTab === t ? '#fff' : 'var(--color-text)',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Standen */}
      {matchTab === 'standen' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(comp.poules || []).map(poule => (
            <div key={poule.id} style={{ flex: '1 1 260px', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '6px 8px 6px 10px', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-border)' }}>
                {poule.name}
              </div>
              <DiscStandingsTable poule={poule} />
            </div>
          ))}
          {(comp.poules || []).length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Geen poules gevonden
            </div>
          )}
        </div>
      )}

      {/* Wedstrijden */}
      {matchTab === 'wedstrijden' && (
        matchData === null ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 24 }}>Laden…</div>
        ) : (() => {
          const allTeams = [...new Set(
            (matchData.poules || []).flatMap(p => [
              ...(p.finished || []).flatMap(m => [m.home, m.away]),
              ...(p.scheduled || []).flatMap(m => [m.home, m.away]),
            ]).filter(Boolean)
          )].sort()

          const matchesTeam = (m) => !teamFilter ||
            m.home === teamFilter || m.away === teamFilter

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {allTeams.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    color: 'var(--color-text)', fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                    <option value="">Alle teams</option>
                    {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {teamFilter && (
                    <button onClick={() => setTeamFilter('')} style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 11,
                      border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                      color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>✕</button>
                  )}
                </div>
              )}

              {(matchData.poules || []).map(poule => {
                const fin  = (poule.finished  || []).filter(matchesTeam)
                const sched = (poule.scheduled || []).filter(matchesTeam)
                if (fin.length === 0 && sched.length === 0) return null
                return (
                  <div key={poule.id}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: 'var(--color-text-muted)',
                      marginBottom: 6, paddingLeft: 2 }}>{poule.name}</div>

                    {fin.map((m, i) => (
                      <div key={m.match_id ?? i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', borderRadius: 8, marginBottom: 4,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        fontSize: 12,
                      }}>
                        {m.date && <span style={{ fontSize: 10, color: 'var(--color-text-muted)',
                          flexShrink: 0, width: 70 }}>{fmtDate(m.date)}</span>}
                        <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: teamFilter === m.home ? 700 : 400 }}>{m.home}</span>
                        <span style={{ fontWeight: 700, flexShrink: 0, minWidth: 40, textAlign: 'center',
                          color: 'var(--color-primary)' }}>{fmtScore(m.home_score, m.away_score)}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: teamFilter === m.away ? 700 : 400 }}>{m.away}</span>
                      </div>
                    ))}

                    {sched.map((m, i) => (
                      <div key={m.match_id ?? i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', borderRadius: 8, marginBottom: 4,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        fontSize: 12,
                      }}>
                        {m.date && <span style={{ fontSize: 10, color: 'var(--color-text-muted)',
                          flexShrink: 0, width: 70 }}>{fmtDate(m.date)}</span>}
                        <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: teamFilter === m.home ? 700 : 400 }}>{m.home}</span>
                        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0,
                          minWidth: 40, textAlign: 'center', fontSize: 11 }}>vs</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: teamFilter === m.away ? 700 : 400 }}>{m.away}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })()
      )}
    </div>
  )
}

// ── Competitie lijst view ─────────────────────────────────────────────────────

function CompetitieList({ compsData, onSelect, onRemove, isAdmin }) {
  if (compsData.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)',
        padding: '40px 0', fontSize: 13, fontStyle: 'italic' }}>
        Nog geen competities gekoppeld aan dit toernooi.
        {isAdmin && <><br />Gebruik "+ Koppelen" hierboven om competities toe te voegen.</>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {compsData.map(comp => {
        const poules = comp.poules ?? []
        const pouleTekst = poules.length > 0
          ? poules.map(p => p.name).join(' · ')
          : 'Geen poules'
        const tags = comp.fase_tags ?? []
        return (
          <div key={comp.link_id} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
            <button onClick={() => onSelect(comp)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{comp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[comp.class_name, comp.district].filter(Boolean).join(' · ')}
                  {(comp.class_name || comp.district) && pouleTekst ? ' — ' : ''}
                  {pouleTekst}
                </div>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    {tags.map(t => (
                      <span key={t.id} style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 20,
                        background: 'var(--color-primary)', color: '#fff',
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>{t.name}</span>
                    ))}
                  </div>
                )}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 14, flexShrink: 0 }}>›</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => onRemove(comp.link_id, comp.name)}
                title="Competitie ontkoppelen"
                style={{
                  padding: '0 12px', borderRadius: 10, border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                  cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', flexShrink: 0,
                }}>✕</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── CompetitieScreen ──────────────────────────────────────────────────────────

export function CompetitieScreen({ tournament, isAdmin, onDeleted }) {
  const [view,         setView]         = useState('overzicht') // 'overzicht' | 'koppelen'
  const [compsData,    setCompsData]    = useState(null)
  const [selectedComp, setSelectedComp] = useState(null)

  function reload() {
    getTournamentCompetitionStandings(tournament.id)
      .then(data => setCompsData(data.competitions || []))
      .catch(() => setCompsData([]))
  }

  useEffect(() => {
    setSelectedComp(null)
    setView('overzicht')
    reload()
  }, [tournament.id])

  function handleBack() {
    setSelectedComp(null)
    reload()
  }

  async function handleDeletePublication() {
    if (!window.confirm(`Publicatie "${tournament.name}" definitief verwijderen?`)) return
    try {
      await deleteTournament(tournament.id)
      onDeleted?.()
    } catch {
      alert('Verwijderen mislukt')
    }
  }

  async function handleRemoveComp(linkId, compName) {
    if (!window.confirm(`"${compName}" ontkoppelen van deze publicatie?`)) return
    try {
      await removeTournamentComp(tournament.id, linkId)
      reload()
    } catch {
      alert('Ontkoppelen mislukt')
    }
  }

  if (selectedComp) {
    return (
      <CompetitieDetail
        comp={selectedComp}
        isAdmin={isAdmin}
        onBack={handleBack}
      />
    )
  }

  return (
    <div>
      {/* Header + tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tournament.name}
          </div>
          {tournament.season && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tournament.season}</div>
          )}
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {['overzicht', 'koppelen'].map(v => (
              <button key={v} onClick={() => { setView(v); if (v === 'overzicht') reload() }} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12,
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: view === v ? 600 : 400,
                border: `1px solid ${view === v ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: view === v ? 'var(--color-primary)' : 'var(--color-surface)',
                color: view === v ? '#fff' : 'var(--color-text)',
              }}>
                {v === 'overzicht' ? 'Overzicht' : '+ Koppelen'}
              </button>
            ))}
            <button onClick={handleDeletePublication} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12,
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: 400,
              border: '1px solid #dc2626', background: 'transparent', color: '#dc2626',
            }}>Verwijderen</button>
          </div>
        )}
      </div>

      {/* Koppelen (admin) */}
      {view === 'koppelen' && isAdmin && (
        <CompetitiesTab tid={tournament.id} />
      )}

      {/* Overzicht */}
      {view === 'overzicht' && (
        compsData === null
          ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>Laden…</div>
          : <CompetitieList compsData={compsData} onSelect={setSelectedComp} onRemove={handleRemoveComp} isAdmin={isAdmin} />
      )}
    </div>
  )
}
