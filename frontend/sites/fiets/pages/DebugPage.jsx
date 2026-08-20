import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

const th = { padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }
const td = { padding: '4px 8px', whiteSpace: 'nowrap' }
const groupTh = { ...th, textAlign: 'center', borderLeft: '2px solid var(--color-border)' }

// Defaults matchen de vaste verdeling in services/fiets.py (NIGHT_WEIGHT=0.35,
// RAIN_WEIGHT=0.25, TEMP_WIND_BUDGET=0.25 @ 60/40, SUN_WEIGHT=0.15) — als
// startpunt voor de sliders.
const DEFAULT_WEIGHTS = { night: 35, rain: 25, temp: 15, sun: 15, wind: 10 }
const WEIGHT_FIELDS = [
  { key: 'night', label: 'Nacht', prefKey: 'fiets_weight_night' },
  { key: 'rain',  label: 'Regen', prefKey: 'fiets_weight_rain' },
  { key: 'temp',  label: 'Temperatuur', prefKey: 'fiets_weight_temp' },
  { key: 'sun',   label: 'Zon', prefKey: 'fiets_weight_sun' },
  { key: 'wind',  label: 'Wind', prefKey: 'fiets_weight_wind' },
]

export default function DebugPage() {
  const [rows,    setRows]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [weights, setWeights] = useState(null)
  const [saving,  setSaving]  = useState(false)

  function load() {
    api.get('/api/fiets/debug')
      .then(d => setRows(d.rows || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get('/api/auth/me/ui-prefs').then(prefs => {
      setWeights({
        night: prefs.fiets_weight_night ?? DEFAULT_WEIGHTS.night,
        rain: prefs.fiets_weight_rain ?? DEFAULT_WEIGHTS.rain,
        temp: prefs.fiets_weight_temp ?? DEFAULT_WEIGHTS.temp,
        sun:  prefs.fiets_weight_sun ?? DEFAULT_WEIGHTS.sun,
        wind: prefs.fiets_weight_wind ?? DEFAULT_WEIGHTS.wind,
      })
    }).catch(() => setWeights(DEFAULT_WEIGHTS))
  }, [])

  function updateWeight(key, value) {
    const next = { ...weights, [key]: value }
    setWeights(next)
  }

  async function saveWeights() {
    setSaving(true)
    try {
      await api.patch('/api/auth/me/ui-prefs', {
        fiets_weight_night: Number(weights.night), fiets_weight_rain: Number(weights.rain),
        fiets_weight_temp: Number(weights.temp), fiets_weight_sun: Number(weights.sun),
        fiets_weight_wind: Number(weights.wind),
      })
      setLoading(true)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !weights) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
  if (error) return <p style={{ padding: 20, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>

  const total = WEIGHT_FIELDS.reduce((sum, f) => sum + Number(weights[f.key] || 0), 0) || 1

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Ruwe brondata per model (KNMI/GFS los), het geblende resultaat en de score-tussenstappen, per uur.
        Puur om te leren hoe de score tot stand komt — sleep horizontaal om alle kolommen te zien.
      </p>

      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14,
        padding: '12px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10,
      }}>
        {WEIGHT_FIELDS.map(f => (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{f.label}</label>
            <input
              type="number" min={0} max={100} value={weights[f.key]}
              onChange={e => updateWeight(f.key, e.target.value)}
              style={{
                width: 56, fontSize: 12, padding: '4px 6px', borderRadius: 6,
                border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
              {Math.round(Number(weights[f.key] || 0) / total * 100)}%
            </span>
          </div>
        ))}
        <button
          onClick={saveWeights}
          disabled={saving}
          style={{
            fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
            border: '1px solid var(--color-border)', background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Opslaan…' : 'Toepassen'}
        </button>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          getallen zijn onderlinge verhouding, worden genormaliseerd naar 100%
        </span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
          <thead>
            <tr>
              <th style={th}>tijd</th>
              <th style={groupTh} colSpan={5}>KNMI</th>
              <th style={groupTh} colSpan={5}>GFS</th>
              <th style={groupTh} colSpan={5}>Geblend</th>
              <th style={groupTh}>2brn</th>
              <th style={groupTh} colSpan={7}>Score</th>
            </tr>
            <tr>
              <th style={th}></th>
              {['temp','mm','code','bew%','wind'].map(h => <th key={`k-${h}`} style={th}>{h}</th>)}
              {['temp','mm','code','bew%','wind'].map(h => <th key={`g-${h}`} style={th}>{h}</th>)}
              {['temp','mm','tier','bew%','wind'].map(h => (
                <th key={`b-${h}`} style={th}>
                  {h}
                  {h === 'tier' && (
                    <span
                      title="Regen-intensiteitsklasse (0-3), afgeleid uit de WMO weather_code: 0 = droog/bewolkt, 1 = lichte motregen, 2 = matige motregen/regen, 3 = zware regen/onweer/ijzel. Strengste van de twee bronnen (voorzichtigheidsprincipe). Bepaalt samen met mm de regen-score."
                      style={{ marginLeft: 3, cursor: 'help', fontWeight: 400 }}
                    >
                      ⓘ
                    </span>
                  )}
                </th>
              ))}
              <th style={th}></th>
              {['dag','nacht','regen','temp','zon','wind','totaal'].map(h => <th key={`s-${h}`} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{r.time.slice(5).replace('T', ' ')}</td>
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
                <td style={td}>{r.is_daytime ? '☀️' : '🌙'}</td>
                <td style={td}>{r.score.night_contrib}</td>
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
