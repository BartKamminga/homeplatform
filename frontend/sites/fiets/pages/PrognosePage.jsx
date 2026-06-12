import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

const SCORE_COLOR = s => s >= 8 ? '#22c55e' : s >= 5 ? '#f59e0b' : '#ef4444'
const SCORE_LABEL = s => s >= 8 ? 'Uitstekend' : s >= 6 ? 'Goed' : s >= 4 ? 'Matig' : 'Slecht'
const SCORE_ICON  = s => s >= 8 ? '🟢' : s >= 6 ? '🟡' : s >= 4 ? '🟠' : '🔴'

export default function PrognosePage() {
  const [days,    setDays]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get('/api/fiets/prognose')
      .then(data => setDays(data.days ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={center}>
      <span style={{ fontSize: 40 }}>🚴</span>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Prognose laden…</p>
    </div>
  )

  if (error) return (
    <div style={center}>
      <span style={{ fontSize: 40 }}>⚠️</span>
      <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 12 }}>{error}</p>
    </div>
  )

  if (days.length === 0) return (
    <div style={center}>
      <span style={{ fontSize: 56 }}>🚴</span>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginTop: 16, maxWidth: 260, lineHeight: 1.5, textAlign: 'center' }}>
        De fietsweersvoorspelling is nog in ontwikkeling.
        <br /><br />
        Binnenkort zie je hier wanneer het beste moment is om te gaan fietsen.
      </p>
    </div>
  )

  return (
    <div style={{ padding: '20px 16px' }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Wanneer is het deze week goed fietsweer?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {days.map((day, i) => (
          <div key={i} style={{
            background: 'var(--color-surface)', border: `1px solid var(--color-border)`,
            borderRadius: 14, padding: '14px 16px',
            borderLeft: `4px solid ${SCORE_COLOR(day.score ?? 0)}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {day.label ?? new Date(day.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
                </div>
                {day.summary && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{day.summary}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: SCORE_COLOR(day.score ?? 0) }}>
                  {SCORE_ICON(day.score ?? 0)}
                </div>
                <div style={{ fontSize: 11, color: SCORE_COLOR(day.score ?? 0), fontWeight: 600, marginTop: 2 }}>
                  {SCORE_LABEL(day.score ?? 0)}
                </div>
              </div>
            </div>
            {(day.temp_min != null || day.wind_kmh != null || day.rain_mm != null) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
                {day.temp_min != null && day.temp_max != null && (
                  <span>🌡 {day.temp_min}–{day.temp_max}°C</span>
                )}
                {day.wind_kmh != null && <span>💨 {day.wind_kmh} km/u</span>}
                {day.rain_mm  != null && <span>🌧 {day.rain_mm} mm</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const center = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
}
