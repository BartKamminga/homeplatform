import { useState, useEffect } from 'react'
import { getTournamentCompetitionStandings, getCompetitionMatches, syncCompetition } from '../api.js'

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
  if (rows.length === 0) return (
    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
      Nog geen stand
    </div>
  )
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
          {comp.hockey_type && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {comp.hockey_type === 'ZA' ? '🏒 Zaal' : '🏑 Veld'}
            </div>
          )}
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(matchData.poules || []).map(poule => (
              <div key={poule.id}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--color-text-muted)',
                  marginBottom: 6, paddingLeft: 2 }}>{poule.name}</div>

                {poule.finished.length === 0 && poule.scheduled.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    Geen wedstrijden
                  </div>
                )}

                {poule.finished.map((m, i) => (
                  <div key={m.match_id ?? i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderRadius: 8, marginBottom: 4,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    fontSize: 12,
                  }}>
                    {m.date && <span style={{ fontSize: 10, color: 'var(--color-text-muted)',
                      flexShrink: 0, width: 70 }}>{fmtDate(m.date)}</span>}
                    <span style={{ flex: 1, textAlign: 'right',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
                    <span style={{ fontWeight: 700, flexShrink: 0, minWidth: 40, textAlign: 'center',
                      color: 'var(--color-primary)' }}>{fmtScore(m.home_score, m.away_score)}</span>
                    <span style={{ flex: 1, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away}</span>
                  </div>
                ))}

                {poule.scheduled.map((m, i) => (
                  <div key={m.match_id ?? i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderRadius: 8, marginBottom: 4,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    fontSize: 12, opacity: 0.7,
                  }}>
                    {m.date && <span style={{ fontSize: 10, color: 'var(--color-text-muted)',
                      flexShrink: 0, width: 70 }}>{fmtDate(m.date)}</span>}
                    <span style={{ flex: 1, textAlign: 'right',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
                    <span style={{ color: 'var(--color-text-muted)', flexShrink: 0,
                      minWidth: 40, textAlign: 'center', fontSize: 11 }}>vs</span>
                    <span style={{ flex: 1, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.away}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── Competitie lijst view ─────────────────────────────────────────────────────

function CompetitieList({ fasesData, onSelect }) {
  if (fasesData.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)',
        padding: '40px 0', fontSize: 13, fontStyle: 'italic' }}>
        Nog geen competities gekoppeld aan dit toernooi.<br />
        Gebruik de Beheer-tab om competities te koppelen.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fasesData.map(fase => (
        <div key={fase.fase}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--color-text-muted)',
            marginBottom: 6, paddingLeft: 2 }}>
            {fase.label}
          </div>
          {fase.competitions.map(comp => {
            const aantalPoules = comp.poules?.length ?? 0
            const metStand = comp.poules?.filter(p => p.standings?.length > 0).length ?? 0
            return (
              <button key={comp.link_id} onClick={() => onSelect(comp)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10, marginBottom: 6,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>
                  {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
                </span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{comp.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {aantalPoules} poule{aantalPoules !== 1 ? 's' : ''}
                    {metStand > 0 && ` · ${metStand} met stand`}
                  </div>
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>›</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── CompetitieScreen ──────────────────────────────────────────────────────────

export function CompetitieScreen({ tournament, isAdmin, onBeheer }) {
  const [fasesData,    setFasesData]    = useState(null)
  const [selectedComp, setSelectedComp] = useState(null)

  useEffect(() => {
    setSelectedComp(null)
    getTournamentCompetitionStandings(tournament.id)
      .then(data => setFasesData(data.fases || []))
      .catch(() => setFasesData([]))
  }, [tournament.id])

  if (fasesData === null) {
    return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>Laden…</div>
  }

  if (selectedComp) {
    return (
      <CompetitieDetail
        comp={selectedComp}
        isAdmin={isAdmin}
        onBack={() => setSelectedComp(null)}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{tournament.name}</div>
          {tournament.season && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tournament.season}</div>
          )}
        </div>
        {isAdmin && (
          <button onClick={onBeheer} style={{
            background: 'none', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'inherit',
          }}>⚙ Beheer</button>
        )}
      </div>
      <CompetitieList fasesData={fasesData} onSelect={setSelectedComp} />
    </div>
  )
}
