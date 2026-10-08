import { useState, useEffect } from 'react'
import { getRegroupingForecast } from '../../api.js'

// Item 1231: herindelingsprognose (bestaande Poulebord-berekening, item 1182):
// in welke competitie en poule Victoria na de herfst waarschijnlijk komt, met
// de verwachte tegenstanders. Eigen weergave in MO14-stijl i.p.v. de
// Poulebord-kaart (ander thema, pin-systeem).

function findTeam(forecast, teamId) {
  for (const target of forecast.targets || []) {
    for (const pool of target.pools || []) {
      if (pool.teams.some(t => t.team_id === teamId)) return { target, pool }
    }
    if ((target.seeding || []).some(t => t.team_id === teamId)) return { target, pool: null }
  }
  return null
}

export default function RegroupingForecast({ tournamentId, teamId }) {
  const [forecast, setForecast] = useState(undefined)

  useEffect(() => {
    getRegroupingForecast(tournamentId).then(d => setForecast(d.forecast)).catch(() => setForecast(null))
  }, [tournamentId])

  if (!forecast) return null
  const hit = findTeam(forecast, teamId)
  const { played, total } = forecast.progress || {}

  return (
    <div className="yof-card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Herindelingsprognose</h3>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>
        Waar komt het team na de herfst waarschijnlijk terecht? Op basis van de huidige standen
        {total ? ` (${played} van ${total} wedstrijden gespeeld)` : ''}. Hoe verder de competitie, hoe betrouwbaarder.
      </p>
      {!hit ? (
        <p style={{ fontSize: 13 }}>Nog geen prognose voor dit team.</p>
      ) : (
        <>
          <div style={{ padding: '10px 12px', background: '#12203c', color: 'white', borderRadius: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.05em' }}>Verwacht</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f4c81e' }}>
              {hit.target.name}{hit.pool ? ` · ${hit.pool.name}` : ''}
            </div>
          </div>
          {hit.pool && (
            <>
              <div style={{ display: 'grid', gap: 4 }}>
                {hit.pool.teams.map(t => (
                  <div key={t.team_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 6px', borderRadius: 8,
                    background: t.team_id === teamId ? '#fdf8e8' : 'transparent', fontWeight: t.team_id === teamId ? 700 : 400,
                  }}>
                    {t.club_logo_url
                      ? <img src={t.club_logo_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ width: 20 }} />}
                    <span style={{ flex: 1 }}>{t.team_name}</span>
                    <span style={{ fontSize: 11, color: '#888' }} title={t.origin_poule}>{t.via}{t.provisional ? ' (voorlopig)' : ''}</span>
                  </div>
                ))}
              </div>
              {hit.pool.travel?.minutes != null && (
                <p style={{ fontSize: 12, color: hit.pool.too_far ? '#c23b3b' : '#666', margin: '8px 0 0' }}>
                  Langste reis in deze poule: ~{Math.floor(hit.pool.travel.minutes / 60)}u{String(hit.pool.travel.minutes % 60).padStart(2, '0')}
                  {hit.pool.travel.between?.length === 2 ? ` (${hit.pool.travel.between.join(' – ')})` : ''}
                  {hit.pool.too_far ? ' · boven de 2 uur, de indeling kan nog verschuiven' : ''}
                </p>
              )}
            </>
          )}
          <p style={{ fontSize: 11, color: '#999', margin: '8px 0 0' }}>Bron: {forecast.rule_source}</p>
        </>
      )}
    </div>
  )
}
