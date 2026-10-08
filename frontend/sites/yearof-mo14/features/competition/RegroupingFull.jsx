import { useState, useEffect } from 'react'
import { getRegroupingForecast } from '../../api.js'

// Hele herindelingsprognose (item 1231, tab Topklasse): per doelcompetitie
// (Super O14, IDC O14, Subtopklasse, ...) alle voorspelde poules met teams,
// herkomst en langste reis; doelen zonder poules (regionaal ingedeeld)
// tonen de plaatsingslijst. Eigen team uitgelicht. Het stuk voor alleen het
// eigen team staat op de tab Competitie (RegroupingForecast).

const fmtTravel = min => `~${Math.floor(min / 60)}u${String(min % 60).padStart(2, '0')}`

function TeamLine({ t, teamId }) {
  const ours = t.team_id === teamId
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 4px', borderRadius: 6,
      background: ours ? '#fdf8e8' : 'transparent', fontWeight: ours ? 700 : 400,
    }}>
      {t.club_logo_url
        ? <img src={t.club_logo_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : <span style={{ width: 16, flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.team_name.replace(' MO14-1', '')}</span>
      <span title={`${t.via} · ${t.origin_poule}`} style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>
        {t.origin_district ? `${t.origin_district.replace(' Nederland', '')} ` : ''}{t.origin_code}{t.provisional ? '?' : ''}
      </span>
    </div>
  )
}

function PoolCard({ pool, teamId }) {
  const ours = pool.teams.some(t => t.team_id === teamId)
  return (
    <div className="yof-card" style={{ padding: 10, border: ours ? '2px solid #f4c81e' : '1px solid #e6e9f0' }}>
      <strong style={{ fontSize: 13 }}>{pool.name}</strong>
      <div style={{ marginTop: 6 }}>{pool.teams.map(t => <TeamLine key={t.team_id} t={t} teamId={teamId} />)}</div>
      {pool.travel?.minutes != null && (
        <div style={{ fontSize: 11, marginTop: 6, color: pool.too_far ? '#c23b3b' : '#888' }}>
          Langste reis {fmtTravel(pool.travel.minutes)}{pool.too_far ? ' · boven de grens' : ''}
        </div>
      )}
    </div>
  )
}

export default function RegroupingFull({ tournamentId, teamId }) {
  const [forecast, setForecast] = useState(undefined)
  const [targetKey, setTargetKey] = useState(null)

  useEffect(() => {
    getRegroupingForecast(tournamentId).then(d => {
      setForecast(d.forecast)
      // Standaard het doel waar het eigen team in valt
      const own = (d.forecast?.targets || []).find(t => (t.seeding || []).some(s => s.team_id === teamId))
      setTargetKey(own?.key || d.forecast?.targets?.[0]?.key || null)
    }).catch(() => setForecast(null))
  }, [tournamentId, teamId])

  if (!forecast) return null
  const target = forecast.targets.find(t => t.key === targetKey) || forecast.targets[0]
  const { played, total } = forecast.progress || {}

  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Herindelingsprognose</h3>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>
        Zo wordt de MO14 na de herfst waarschijnlijk ingedeeld, op basis van de huidige standen
        {total ? ` (${played} van ${total} wedstrijden gespeeld)` : ''}. Een ? = positie nog voorlopig.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {forecast.targets.map(t => (
          <button key={t.key} onClick={() => setTargetKey(t.key)} style={{
            borderRadius: 999, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
            border: target.key === t.key ? '2px solid #12203c' : '1px solid #ccd3e0',
            background: target.key === t.key ? '#12203c' : 'white', color: target.key === t.key ? 'white' : '#12203c',
          }}>
            {t.name}
          </button>
        ))}
      </div>
      {(target.pools || []).length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
          {target.pools.map(p => <PoolCard key={p.name} pool={p} teamId={teamId} />)}
        </div>
      ) : (
        <div className="yof-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Regionaal ingedeeld - plaatsingslijst:</div>
          {(target.seeding || []).map(t => <TeamLine key={t.team_id} t={t} teamId={teamId} />)}
        </div>
      )}
      <p style={{ fontSize: 11, color: '#999', margin: '8px 0 0' }}>Bron: {forecast.rule_source}</p>
    </div>
  )
}
