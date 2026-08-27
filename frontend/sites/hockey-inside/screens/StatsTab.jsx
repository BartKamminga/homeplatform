import { useState, useEffect, useMemo } from 'react'
import { api } from '@core/api.js'
import { statBox, statNum, statLbl } from './ui.jsx'
import { ghostBtn } from './styles.js'

function resolveHockeyType(t) {
  if (t.hockey_type === 'VE' || t.hockey_type === 'ZA') return t.hockey_type
  if (t.short_name && t.short_name[0] === 'z') return 'ZA'
  return 'VE'
}

export default function StatsTab() {
  const [clubs,       setClubs]       = useState([])
  const [teams,       setTeams]       = useState([])
  const [queue,       setQueue]       = useState(null)
  const [errors,      setErrors]      = useState([])
  const [seasonStats, setSeasonStats] = useState([])
  const [dataQuality, setDataQuality] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [rangeData,   setRangeData]   = useState(null)
  const [isInferring, setIsInferring] = useState(false)
  const [inferResult, setInferResult] = useState(null)

  function loadRanges() { api.get('/api/hockey/poule-ranges').then(setRangeData).catch(() => {}) }

  function runInfer() {
    setIsInferring(true); setInferResult(null)
    api.post('/api/hockey/infer-season-pending', {})
      .then(r => {
        setInferResult(r)
        loadRanges()
        api.get('/api/hockey/poule-queue').then(setQueue).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setIsInferring(false))
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/hockey/clubs'),
      api.get('/api/hockey/teams'),
      api.get('/api/hockey/poule-queue'),
      api.get('/api/hockey/plugin-errors?limit=5'),
      api.get('/api/hockey/stats/by-season'),
      api.get('/api/hockey/poule-ranges'),
      api.get('/api/hockey/stats/data-quality'),
    ]).then(([clubsRes, teamsRes, queueRes, errRes, seasonRes, rangeRes, dqRes]) => {
      setClubs(clubsRes.clubs || [])
      setTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setErrors(errRes.errors || [])
      setSeasonStats(seasonRes.stats || [])
      setRangeData(rangeRes)
      setDataQuality(dqRes)
    }).finally(() => setLoading(false))
  }, [])

  const dqGroups = useMemo(() => {
    if (!dataQuality) return []
    const map = new Map()
    for (const r of dataQuality.rows) {
      const key = r.competition_name || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return [...map.entries()].map(([name, rows]) => {
      const week         = rows.reduce((n, r) => n + r.week, 0)
      const geen_tijd     = rows.reduce((n, r) => n + r.geen_tijd, 0)
      const mist_uitslag  = rows.reduce((n, r) => n + r.mist_uitslag, 0)
      return {
        name, rows,
        poules:      rows.length,
        wedstrijden: week + geen_tijd + mist_uitslag,
        week, geen_tijd, mist_uitslag,
      }
    })
  }, [dataQuality])

  const detailLoaded = clubs.filter(c => c.detail_loaded).length
  const noDetail     = clubs.length - detailLoaded
  const youthCount   = teams.filter(t => t.category_group_name === 'Junioren').length
  const seniorCount  = teams.filter(t => t.category_group_name !== 'Junioren').length
  const veldCount    = teams.filter(t => resolveHockeyType(t) === 'VE').length
  const zaalCount    = teams.filter(t => resolveHockeyType(t) === 'ZA').length

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 24, textAlign: 'center' }}>Laden…</div>
  }

  const section = (label) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>{label}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        {section('Clubs')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={statBox}><span style={statNum}>{clubs.length}</span><span style={statLbl}>clubs</span></div>
          <div style={statBox}><span style={statNum}>{detailLoaded}</span><span style={statLbl}>detail geladen</span></div>
          {noDetail > 0 && (
            <div style={{ ...statBox, borderColor: '#f59e0b' }}>
              <span style={{ ...statNum, color: '#f59e0b' }}>{noDetail}</span>
              <span style={statLbl}>geen detail</span>
            </div>
          )}
        </div>
      </div>

      <div>
        {section('Teams')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={statBox}><span style={statNum}>{teams.length}</span><span style={statLbl}>totaal</span></div>
          <div style={statBox}><span style={statNum}>{youthCount}</span><span style={statLbl}>jeugd</span></div>
          <div style={statBox}><span style={statNum}>{seniorCount}</span><span style={statLbl}>senioren</span></div>
          <div style={statBox}><span style={statNum}>{veldCount}</span><span style={statLbl}>🏑 veld</span></div>
          <div style={statBox}><span style={statNum}>{zaalCount}</span><span style={statLbl}>🏒 zaal</span></div>
        </div>
      </div>

      {queue && (
        <div>
          {section(`Poule coverage ${queue.target_season || '2026-2027'}`)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ ...statBox, borderColor: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-border)' }}>
              <span style={{ ...statNum, color: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
                {queue.captured}/{queue.total}
              </span>
              <span style={statLbl}>gevangen</span>
            </div>
            {queue.stale > 0 && (
              <div style={statBox}><span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.stale}</span><span style={statLbl}>oud seizoen</span></div>
            )}
            {queue.waiting > 0 && (
              <div style={statBox}><span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.waiting}</span><span style={statLbl}>⏳ wacht</span></div>
            )}
          </div>
          {queue.total > 0 && (
            <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--color-success)',
                width: `${Math.round(queue.captured / queue.total * 100)}%`,
                transition: 'width 0.4s',
              }} />
            </div>
          )}
        </div>
      )}

      {dataQuality && (
        <div>
          {section(`Data-kwaliteit ${dataQuality.season || ''}`)}
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 10 }}>
            📅/⏳ = wedstrijden t/m 7 dagen vooruit (met/zonder bekende kicktijd) · ❗ = wedstrijden van de afgelopen 7 dagen zonder uitslag
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: dataQuality.rows.length > 0 ? 10 : 0 }}>
            <div style={statBox}><span style={statNum}>{dataQuality.rows.reduce((n, r) => n + r.mist_uitslag, 0)}</span><span style={statLbl}>❗ uitslag mist</span></div>
            <div style={statBox}><span style={statNum}>{dataQuality.rows.reduce((n, r) => n + r.geen_tijd, 0)}</span><span style={statLbl}>⏳ tijd onbekend</span></div>
            <div style={statBox}><span style={statNum}>{dataQuality.poules_without_team}</span><span style={statLbl}>🕳️ geen team-koppeling</span></div>
            <div style={statBox}><span style={statNum}>{dataQuality.teams_season_pending}</span><span style={statLbl}>⏸️ season pending</span></div>
            <div style={statBox}><span style={statNum}>{dataQuality.ghost_poules}</span><span style={statLbl}>👻 ghost-poules</span></div>
            <div style={statBox}><span style={statNum}>{dataQuality.clubs_never_scanned}</span><span style={statLbl}>🏚️ clubs nooit gescand</span></div>
          </div>
          {dqGroups.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600 }}>Competitie</th>
                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600 }}>Poules</th>
                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600 }}>Wedstrijden</th>
                    <th title="Wedstrijden t/m 7 dagen vooruit met bekende kicktijd" style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600, cursor: 'help' }}>📅 Komende week</th>
                    <th title="Wedstrijden t/m 7 dagen vooruit waarvan de kicktijd nog niet bekend is" style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600, cursor: 'help' }}>⏳ Tijd onbekend</th>
                    <th title="Wedstrijden van de afgelopen 7 dagen zonder uitslag" style={{ textAlign: 'right', padding: '4px 0 4px 4px', fontWeight: 600, cursor: 'help' }}>❗ Uitslag mist</th>
                  </tr>
                </thead>
                <tbody>
                  {dqGroups.map(g => (
                    <tr key={g.name} style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                      <td style={{ padding: '5px 8px 5px 0' }}>{g.name}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--color-text-muted)' }}>{g.poules}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--color-text-muted)' }}>{g.wedstrijden}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: g.week ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{g.week || '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: g.geen_tijd ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{g.geen_tijd || '—'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 0 5px 4px', color: g.mist_uitslag ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{g.mist_uitslag || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dataQuality.total_signaled_poules > dataQuality.rows.length && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  + {dataQuality.total_signaled_poules - dataQuality.rows.length} meer (top 30 getoond)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div>
          {section(`Plugin fouten (${errors.length})`)}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-danger)' }}>
            Bekijk details in de Scout tab.
          </div>
        </div>
      )}

      {seasonStats.length > 0 && (
        <div>
          {section('Seizoen coverage')}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600 }}>Seizoen</th>
                  <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600 }}>Comp.</th>
                  <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600 }}>Poules</th>
                  <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600 }}>Gevangen</th>
                  <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 600 }}>Wedstrijden</th>
                  <th style={{ textAlign: 'right', padding: '4px 0 4px 4px', fontWeight: 600 }}>Autoscan</th>
                </tr>
              </thead>
              <tbody>
                {seasonStats.map(s => {
                  const pct         = s.total_poules > 0 ? Math.round(s.captured_poules / s.total_poules * 100) : 0
                  const autoscanPct = s.total_poules > 0 ? Math.round((s.autoscan_poules || 0) / s.total_poules * 100) : 0
                  return (
                    <tr key={s.season} style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                      <td style={{ padding: '5px 8px 5px 0', fontWeight: s.season === queue?.target_season ? 700 : 400 }}>{s.season}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--color-text-muted)' }}>{s.competitions}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--color-text-muted)' }}>{s.total_poules}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px' }}>
                        <span style={{ color: pct === 100 && s.total_poules > 0 ? 'var(--color-success)' : pct > 50 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {s.captured_poules}/{s.total_poules}
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4 }}>({pct}%)</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--color-text-muted)' }}>{s.total_matches ?? 0}</td>
                      <td style={{ textAlign: 'right', padding: '5px 0 5px 4px', color: 'var(--color-text-muted)' }}>
                        {s.autoscan_poules || 0}/{s.total_poules}
                        <span style={{ fontSize: 10, marginLeft: 4 }}>({autoscanPct}%)</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rangeData && rangeData.seasons.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {section('Poule ID-reeks')}
            <button onClick={runInfer} disabled={isInferring} style={{ ...ghostBtn, marginLeft: 'auto' }}>
              {isInferring ? '⏳ bezig…' : '⚡ Infereer seizoen'}
            </button>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rangeData.seasons.map(s => (
              <div key={s.season} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '2px 0' }}>
                <span style={{ fontWeight: 600, minWidth: 72 }}>{s.season}</span>
                <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.min_id} – {s.max_id}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>({s.count} poules, span {s.span})</span>
                {s.gap_before > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>gap: {s.gap_before}</span>}
              </div>
            ))}
            {inferResult && (
              <div style={{ marginTop: 6, fontSize: 11, padding: '5px 8px', borderRadius: 6,
                background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))',
                color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                ⚡ {inferResult.marked_pending} teams → season_pending
                {inferResult.cleared_pending > 0 && `, ${inferResult.cleared_pending} gecleard`}
                {inferResult.marked_pending === 0 && inferResult.cleared_pending === 0 && ' — alles al correct'}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
