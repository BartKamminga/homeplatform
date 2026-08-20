import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import SmoothChart, { BREAKDOWN_COLORS } from '../components/SmoothChart.jsx'
import DayCard from '../components/DayCard.jsx'

const TABS = [
  { key: 'fiets', label: 'Fiets',        field: 'score' },
  { key: 'temp',  label: 'Temperatuur',  field: 'temp' },
  { key: 'rain',  label: 'Neerslagkans', field: 'rain_prob' },
  { key: 'wind',  label: 'Wind',         field: 'wind_kmh' },
]

export default function PrognosePage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState('fiets')

  useEffect(() => {
    api.get('/api/fiets/prognose')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={center}>
      <span style={{ fontSize: 40 }}>🚴</span>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Prognose laden…</p>
    </div>
  )

  if (error || data?.status === 'error') return (
    <div style={center}>
      <span style={{ fontSize: 40 }}>⚠️</span>
      <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 12 }}>{error || data?.message}</p>
    </div>
  )

  if (!data || data.days.length === 0) return (
    <div style={center}>
      <span style={{ fontSize: 56 }}>🚴</span>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginTop: 16, maxWidth: 260, lineHeight: 1.5, textAlign: 'center' }}>
        De fietsweersvoorspelling is nog in ontwikkeling.
        <br /><br />
        Binnenkort zie je hier wanneer het beste moment is om te gaan fietsen.
      </p>
    </div>
  )

  const activeField = TABS.find(t => t.key === tab).field

  return (
    <div style={{ padding: '20px 16px' }}>
      {data.location?.label && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>📍 {data.location.label}</p>
      )}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: '16px 12px 10px', marginBottom: 16,
      }}>
        <SmoothChart days={data.days} field={activeField} />
        {tab === 'fiets' && (
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
            <Legend color={BREAKDOWN_COLORS.temp} label="Temperatuur" />
            <Legend color={BREAKDOWN_COLORS.wind} label="Wind" />
            <Legend color={BREAKDOWN_COLORS.sun} label="Zon" />
            <Legend color={BREAKDOWN_COLORS.rain} label="Regen (blokkeert)" />
            <span>· grijze stip = bronnen zijn het niet eens</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.days.map(day => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

const center = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
}
