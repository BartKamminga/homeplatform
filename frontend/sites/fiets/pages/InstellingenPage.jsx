import { useState, useEffect, useRef } from 'react'
import { api } from '@core/api.js'

const DIRECTIONS = [
  { deg: '',    label: 'Geen voorkeur' },
  { deg: 0,     label: 'Noord' },
  { deg: 45,    label: 'Noordoost' },
  { deg: 90,    label: 'Oost' },
  { deg: 135,   label: 'Zuidoost' },
  { deg: 180,   label: 'Zuid' },
  { deg: 225,   label: 'Zuidwest' },
  { deg: 270,   label: 'West' },
  { deg: 315,   label: 'Noordwest' },
]

const WEIGHT_PRESETS = [
  { value: 0.8, label: 'Temperatuur belangrijker' },
  { value: 0.6, label: 'Gebalanceerd' },
  { value: 0.3, label: 'Wind belangrijker' },
]

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12,
}
const controlStyle = (saving) => ({
  fontSize: 13, padding: '5px 10px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontFamily: 'inherit',
  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
})

export default function InstellingenPage() {
  const [prefs,   setPrefs]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs')
      .then(setPrefs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function save(patch) {
    setPrefs(p => ({ ...p, ...patch }))
    setSaving(true)
    try {
      await api.patch('/api/auth/me/ui-prefs', patch)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
  )

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}

      <LocationSetting
        label={prefs.fiets_location_label}
        onSelect={r => save({ fiets_lat: r.lat, fiets_lon: r.lon, fiets_location_label: r.label })}
      />

      <div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
          Wind uit deze richting telt als meewind (gunstig) in de fietsscore.
        </p>
        <div style={rowStyle}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🧭</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Windrichting-voorkeur</span>
          <select
            disabled={saving}
            value={prefs.fiets_wind_pref_deg ?? ''}
            onChange={e => save({ fiets_wind_pref_deg: e.target.value === '' ? null : Number(e.target.value) })}
            style={controlStyle(saving)}
          >
            {DIRECTIONS.map(d => <option key={d.label} value={d.deg}>{d.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
          Weegt tegenwind/harde wind zwaarder mee, of eerder een paar graden te koud/warm?
        </p>
        <div style={rowStyle}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚖️</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Gewicht temperatuur vs. wind</span>
          <select
            disabled={saving}
            value={prefs.fiets_temp_weight ?? 0.6}
            onChange={e => save({ fiets_temp_weight: Number(e.target.value) })}
            style={controlStyle(saving)}
          >
            {WEIGHT_PRESETS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
          Comfortband en drempels waarop de score rekent (MVP-defaults, hier aan te passen).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <NumberRow icon="🌡" label="Prettige temperatuur vanaf" unit="°C" field="fiets_temp_min" defaultValue={15} prefs={prefs} onSave={save} saving={saving} />
          <NumberRow icon="🌡" label="Prettige temperatuur tot" unit="°C" field="fiets_temp_max" defaultValue={22} prefs={prefs} onSave={save} saving={saving} />
          <NumberRow icon="💨" label="Windknikpunt (harder = snel minder prettig)" unit="km/u" field="fiets_wind_knee_kmh" defaultValue={25} last prefs={prefs} onSave={save} saving={saving} />
        </div>
      </div>
    </div>
  )
}

function NumberRow({ icon, label, unit, field, defaultValue, min = -20, max = 45, prefs, onSave, saving, last }) {
  const [local, setLocal] = useState(prefs[field] ?? defaultValue)
  useEffect(() => { setLocal(prefs[field] ?? defaultValue) }, [prefs[field]])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
      <input
        type="number" min={min} max={max} disabled={saving}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => onSave({ [field]: Number(local) })}
        style={{ ...controlStyle(saving), width: 64, textAlign: 'right', cursor: saving ? 'default' : 'text' }}
      />
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 36 }}>{unit}</span>
    </div>
  )
}

function LocationSetting({ label, onSelect }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(() => {
      setSearching(true)
      api.get(`/api/fiets/geocode?q=${encodeURIComponent(query.trim())}`)
        .then(d => setResults(d.results || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        Huidige locatie: <strong style={{ color: 'var(--color-text)' }}>{label || 'onbekend'}</strong>
      </p>
      <div style={rowStyle}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Plaatsnaam zoeken…"
          style={{ flex: 1, fontSize: 13, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit' }}
        />
      </div>
      {searching && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>Zoeken…</p>}
      {results.length > 0 && (
        <div style={{ marginTop: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => { onSelect(r); setQuery(''); setResults([]) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13,
                background: 'transparent', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'inherit',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
