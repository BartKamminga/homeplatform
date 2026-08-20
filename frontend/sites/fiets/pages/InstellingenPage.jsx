import { useState, useEffect } from 'react'
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

export default function InstellingenPage() {
  const [value,   setValue]   = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs')
      .then(prefs => setValue(prefs.fiets_wind_pref_deg ?? ''))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleChange(e) {
    const raw = e.target.value
    const deg = raw === '' ? null : Number(raw)
    setValue(raw)
    setSaving(true)
    try {
      await api.patch('/api/auth/me/ui-prefs', { fiets_wind_pref_deg: deg })
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
    <div style={{ padding: '20px 16px' }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Wind uit deze richting telt als meewind (gunstig) in de fietsscore.
      </p>
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🧭</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Windrichting-voorkeur</span>
        <select
          disabled={saving}
          value={value}
          onChange={handleChange}
          style={{
            fontSize: 13, padding: '5px 10px', borderRadius: 8,
            border: '1px solid var(--color-border)', background: 'var(--color-background)',
            color: 'var(--color-text)', fontFamily: 'inherit',
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {DIRECTIONS.map(d => (
            <option key={d.label} value={d.deg}>{d.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
