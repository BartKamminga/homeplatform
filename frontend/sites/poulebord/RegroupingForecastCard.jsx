import { useEffect, useState } from 'react'
import { C, badgeStyle, cardStyle, pillStyle, pinButtonStyle } from './constants.js'
import { getRegroupingForecast } from './api.js'
import { RankRow, TeamName } from './RankRow.jsx'

// items 1182/1183: prognose van de herindeling na de herfst-/voorcompetitie
// (O14/O16/O18). Berekening + regels zitten in de backend
// (services/hockey_regrouping_forecast.py + _rules.py); deze kaart toont per
// doelcompetitie de poules en de plaatsingslijst (serpentine) waarop die
// indeling gebaseerd is. Doelen zonder poules (regionaal ingedeeld) tonen
// alleen de lijst.

const CACHE_TTL = 5 * 60 * 1000
const _cache = {}

function useRegroupingForecast(tournamentId) {
  const cached = _cache[tournamentId]
  const fresh = cached && Date.now() - cached.ts < CACHE_TTL ? cached.data : undefined
  const [data, setData] = useState(fresh)
  useEffect(() => {
    if (fresh !== undefined) { setData(fresh); return }
    setData(undefined)
    getRegroupingForecast(tournamentId)
      .then(d => { _cache[tournamentId] = { data: d.forecast, ts: Date.now() }; setData(d.forecast) })
      .catch(() => setData(null))
  }, [tournamentId])
  return data
}

function OriginBadge({ entry }) {
  return (
    <span title={`${entry.via} · ${entry.origin_poule}`} style={{ ...badgeStyle(), flexShrink: 0 }}>
      {entry.origin_code}{entry.provisional ? '?' : ''}
    </span>
  )
}

function PoolsView({ pools }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, padding: 8 }}>
      {pools.map(pool => (
        <div key={pool.name} style={{ ...cardStyle(8), background: C.deep }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, padding: '4px 8px',
            borderBottom: `1px solid ${C.border}`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {pool.name}
          </div>
          {pool.teams.map(t => (
            <div key={t.team_id} style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.muted, width: 16, textAlign: 'right', flexShrink: 0 }}>{t.seed}</span>
              <span style={{ flex: 1, minWidth: 0, color: C.chalk, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <TeamName name={t.team_name} logoUrl={t.club_logo_url} showLogos={true} />
              </span>
              <OriginBadge entry={t} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SeedingView({ entries, showPool }) {
  return entries.map((e, i) => (
    <RankRow key={e.team_id}
      rank={e.seed ?? i + 1} logoUrl={e.club_logo_url} name={e.team_name}
      tags={[{ name: `${e.origin_code}${e.provisional ? '?' : ''}` }]}
      meta={`${e.origin_poule} · ${e.points}p/${e.played} · ${e.goal_diff >= 0 ? '+' : ''}${e.goal_diff}`}
      value={showPool ? `→ ${String.fromCharCode(65 + e.pool_index)}` : ''} />
  ))
}

export function RegroupingForecastCard({ pin, pinned, onTogglePin, onUpdate }) {
  const forecast = useRegroupingForecast(pin.tournamentId)
  // Doel-keys verschillen per categorie (O14: super/idc, O16/O18: national/super)
  // - een gepinde of standaard-keuze die hier niet bestaat valt terug op de eerste.
  const target = forecast?.targets.find(t => t.key === pin.target) || forecast?.targets[0]
  const targetKey = target?.key
  const view = target?.pools ? (pin.view || 'pools') : 'seeding'
  const tabs = forecast ? forecast.targets.map(t => ({ key: t.key, label: t.name })) : []
  const progress = forecast?.progress

  return (
    <div style={{ ...cardStyle(), marginBottom: 8 }}>
      <div style={{ padding: '6px 8px 6px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.04em' }}>
          Regrouping forecast
        </span>
        {forecast && <span style={badgeStyle()}>{forecast.category}</span>}
        <span style={{ flex: 1 }} />
        <button onClick={onTogglePin} title={pinned ? 'Remove from board' : 'Pin to board'}
          style={pinButtonStyle(pinned)}>📌</button>
      </div>

      {forecast === undefined ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Loading…</div>
      ) : forecast === null ? (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 10, fontStyle: 'italic' }}>
          No forecast available for this publication
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 10px', alignItems: 'center' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => onUpdate({ target: t.key })}
                style={pillStyle(targetKey === t.key, 'sm')}>{t.label}</button>
            ))}
            {target?.pools && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {[['pools', 'Pools'], ['seeding', 'Seeding list']].map(([k, label]) => (
                  <button key={k} onClick={() => onUpdate({ view: k })} style={pillStyle(view === k, 'sm')}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {target && view === 'pools' && <PoolsView pools={target.pools} />}
          {target && view === 'seeding' && <SeedingView entries={target.seeding} showPool={!!target.pools} />}
          {target?.note && (
            <div style={{ fontSize: 10, color: C.muted, padding: '6px 10px 0', fontStyle: 'italic' }}>{target.note}</div>
          )}

          <div style={{ fontSize: 10, color: C.muted, padding: '6px 10px', lineHeight: 1.5 }}>
            {forecast.season_step}. {progress && `Based on current standings (${progress.played}/${progress.total} matches played). `}
            Seeding: tier by class and position (T1 = Topklasse #1, S1 = Subtopklasse #1), then points,
            goal difference and goals for per match played; distributed in serpentine order,
            max one team per club per pool. Rules: {forecast.rule_source}.
            {forecast.warnings.map(w => (
              <div key={w} style={{ color: C.goldBr }}>⚠ {w}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
