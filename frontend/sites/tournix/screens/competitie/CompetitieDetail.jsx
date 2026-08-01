import { useState, useEffect } from 'react'
import { getCompetitionMatches, syncCompetition } from '../../api.js'
import DiscStandingsTable from './DiscStandingsTable.jsx'

function fmtScore(home, away) {
  if (home == null || away == null) return '–'
  return `${home}–${away}`
}

function fmtDate(d) {
  if (!d) return ''
  const clean = d.replace('T', ' ')
  const [date, timeFull] = clean.split(' ')
  if (timeFull) {
    const t = timeFull.substring(0, 5)
    if (t !== '00:00') return date + ' ' + t
  }
  return date
}

export default function CompetitieDetail({ comp, isAdmin, onBack }) {
  const [matchTab,   setMatchTab]   = useState('standen')
  const [matchData,  setMatchData]  = useState(null)
  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState('')
  const [teamFilter, setTeamFilter] = useState('')

  useEffect(() => { setTeamFilter(''); setMatchData(null) }, [comp.id])

  useEffect(() => {
    if (matchTab === 'wedstrijden' && matchData === null) {
      getCompetitionMatches(comp.id)
        .then(setMatchData)
        .catch(() => setMatchData({ poules: [] }))
    }
  }, [matchTab, comp.id, matchData])

  async function handleSync() {
    setSyncing(true); setSyncMsg('')
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'inherit' }}>← Terug</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{comp.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {[comp.hockey_type === 'ZA' ? '🏒 Zaal' : comp.hockey_type === 'VE' ? '🏑 Veld' : null, comp.class_name, comp.district].filter(Boolean).join(' · ')}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncMsg && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{syncMsg}</span>}
            <button onClick={handleSync} disabled={syncing} style={{
              background: syncing ? 'var(--color-surface)' : 'var(--color-primary)',
              color: syncing ? 'var(--color-text-muted)' : '#fff',
              border: 'none', borderRadius: 8, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, cursor: syncing ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>{syncing ? '⟳ Syncing…' : '🔄 Sync'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['standen', 'wedstrijden'].map(t => (
          <button key={t} onClick={() => setMatchTab(t)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: matchTab === t ? 600 : 400,
            border: `1px solid ${matchTab === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: matchTab === t ? 'var(--color-primary)' : 'var(--color-surface)',
            color: matchTab === t ? '#fff' : 'var(--color-text)',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {matchTab === 'standen' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(comp.poules || []).map(poule => (
            <div key={poule.id} style={{ flex: '1 1 260px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '6px 8px 6px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)' }}>
                {poule.name}
              </div>
              <DiscStandingsTable poule={poule} />
            </div>
          ))}
          {(comp.poules || []).length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>Geen poules gevonden</div>
          )}
        </div>
      )}

      {matchTab === 'wedstrijden' && (
        matchData === null ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 24 }}>Laden…</div>
        ) : (() => {
          const allTeams = [...new Set(
            (matchData.poules || []).flatMap(p => [
              ...(p.finished  || []).flatMap(m => [m.home, m.away]),
              ...(p.scheduled || []).flatMap(m => [m.home, m.away]),
            ]).filter(Boolean)
          )].sort()
          const matchesTeam = m => !teamFilter || m.home === teamFilter || m.away === teamFilter
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {allTeams.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <option value="">Alle teams</option>
                    {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {teamFilter && (
                    <button onClick={() => setTeamFilter('')} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  )}
                </div>
              )}
              {(matchData.poules || []).map(poule => {
                const fin   = (poule.finished  || []).filter(matchesTeam)
                const sched = (poule.scheduled || []).filter(matchesTeam)
                if (fin.length === 0 && sched.length === 0) return null
                return (
                  <div key={poule.id}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6, paddingLeft: 2 }}>{poule.name}</div>
                    {fin.map((m, i) => (
                      <div key={m.match_id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, marginBottom: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12 }}>
                        {m.date && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, width: 70 }}>{fmtDate(m.date)}</span>}
                        <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: teamFilter === m.home ? 700 : 400 }}>{m.home}</span>
                        <span style={{ fontWeight: 700, flexShrink: 0, minWidth: 40, textAlign: 'center', color: 'var(--color-primary)' }}>{fmtScore(m.home_score, m.away_score)}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: teamFilter === m.away ? 700 : 400 }}>{m.away}</span>
                      </div>
                    ))}
                    {sched.map((m, i) => (
                      <div key={m.match_id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, marginBottom: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12 }}>
                        {m.date && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, width: 70 }}>{fmtDate(m.date)}</span>}
                        <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: teamFilter === m.home ? 700 : 400 }}>{m.home}</span>
                        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, minWidth: 40, textAlign: 'center', fontSize: 11 }}>vs</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: teamFilter === m.away ? 700 : 400 }}>{m.away}</span>
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
