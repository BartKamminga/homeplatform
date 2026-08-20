import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

const th = { padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }
const td = { padding: '4px 8px', whiteSpace: 'nowrap' }
const groupTh = { ...th, textAlign: 'center', borderLeft: '2px solid var(--color-border)' }

export default function DebugPage() {
  const [rows,    setRows]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get('/api/fiets/debug')
      .then(d => setRows(d.rows || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
  if (error) return <p style={{ padding: 20, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Ruwe brondata per model (KNMI/GFS los), het geblende resultaat en de score-tussenstappen, per uur.
        Puur om te leren hoe de score tot stand komt — sleep horizontaal om alle kolommen te zien.
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
          <thead>
            <tr>
              <th style={th}>tijd</th>
              <th style={th}>dag</th>
              <th style={groupTh} colSpan={5}>KNMI</th>
              <th style={groupTh} colSpan={5}>GFS</th>
              <th style={groupTh} colSpan={5}>Geblend</th>
              <th style={groupTh}>2brn</th>
              <th style={groupTh} colSpan={5}>Score</th>
            </tr>
            <tr>
              <th style={th}></th><th style={th}></th>
              {['temp','mm','code','bew%','wind'].map(h => <th key={`k-${h}`} style={th}>{h}</th>)}
              {['temp','mm','code','bew%','wind'].map(h => <th key={`g-${h}`} style={th}>{h}</th>)}
              {['temp','mm','tier','bew%','wind'].map(h => <th key={`b-${h}`} style={th}>{h}</th>)}
              <th style={th}></th>
              {['regen','temp','zon','wind','totaal'].map(h => <th key={`s-${h}`} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: r.is_daytime ? 'transparent' : 'var(--color-border)', opacity: r.is_daytime ? 1 : 0.6 }}>
                <td style={td}>{r.time.slice(5).replace('T', ' ')}</td>
                <td style={td}>{r.is_daytime ? '☀️' : '🌙'}</td>
                <td style={td}>{r.sources.knmi.temp}°</td>
                <td style={td}>{r.sources.knmi.rain_mm}</td>
                <td style={td}>{r.sources.knmi.weather_code}</td>
                <td style={td}>{r.sources.knmi.cloud_cover}</td>
                <td style={td}>{Math.round(r.sources.knmi.wind_kmh)}</td>
                <td style={td}>{r.sources.gfs.temp}°</td>
                <td style={td}>{r.sources.gfs.rain_mm}</td>
                <td style={td}>{r.sources.gfs.weather_code}</td>
                <td style={td}>{r.sources.gfs.cloud_cover}</td>
                <td style={td}>{Math.round(r.sources.gfs.wind_kmh)}</td>
                <td style={td}>{r.blended.temp}°</td>
                <td style={td}>{r.blended.rain_mm}</td>
                <td style={td}>{r.blended.rain_tier}</td>
                <td style={td}>{r.blended.cloud_cover}</td>
                <td style={td}>{Math.round(r.blended.wind_kmh)}</td>
                <td style={td}>{r.low_confidence ? '⚠️' : ''}</td>
                <td style={td}>{r.score.rain_contrib}</td>
                <td style={td}>{r.score.temp_contrib}</td>
                <td style={td}>{r.score.sun_contrib}</td>
                <td style={td}>{r.score.wind_contrib}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.score.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
