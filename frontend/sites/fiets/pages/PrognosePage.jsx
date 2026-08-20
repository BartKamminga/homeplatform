import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import SmoothChart, { BREAKDOWN_COLORS } from '../components/SmoothChart.jsx'
import DayCard from '../components/DayCard.jsx'

const TABS = [
  { key: 'fiets', label: 'Fiets',        field: 'score' },
  { key: 'temp',  label: 'Temperatuur',  field: 'temp' },
  { key: 'rain',  label: 'Regen',        field: 'rain_mm' },
  { key: 'wind',  label: 'Wind',         field: 'wind_kmh' },
  { key: 'zon',   label: 'Zon',          field: 'sun_pct' },
]

const SOURCES = [
  { key: 'knmi', label: 'KNMI' },
  { key: 'gfs',  label: 'NOAA GFS' },
]

const WIND_MODES = [
  { key: 'chart', label: 'Grafiek' },
  { key: 'arrow', label: 'Pijl' },
  { key: 'both',  label: 'Beide' },
]

export default function PrognosePage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState('fiets')
  const [sources, setSources] = useState(['knmi', 'gfs'])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showExplainer, setShowExplainer] = useState(false)
  const [windMode, setWindMode] = useState('both')

  useEffect(() => {
    setLoading(true)
    api.get(`/api/fiets/prognose?sources=${sources.join(',')}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sources])

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs')
      .then(prefs => setShowBreakdown(Boolean(prefs.fiets_show_breakdown)))
      .catch(() => {})
  }, [])

  function toggleBreakdown() {
    setShowBreakdown(v => {
      const next = !v
      api.patch('/api/auth/me/ui-prefs', { fiets_show_breakdown: next }).catch(() => {})
      return next
    })
  }

  function toggleSource(key) {
    setSources(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(s => s !== key)
        return next.length > 0 ? next : prev // minstens 1 bron actief houden
      }
      return [...prev, key]
    })
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {data.location?.label && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>📍 {data.location.label}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSource(s.key)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${sources.includes(s.key) ? 'var(--color-text-muted)' : 'var(--color-border)'}`,
                background: sources.includes(s.key) ? 'var(--color-surface)' : 'transparent',
                color: sources.includes(s.key) ? 'var(--color-text)' : 'var(--color-text-muted)',
                opacity: sources.includes(s.key) ? 1 : 0.6,
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setShowExplainer(v => !v)}
            aria-label="Hoe werkt de score?"
            style={{
              fontSize: 15, width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
              border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)',
            }}
          >
            ⓘ
          </button>
        </div>
      </div>
      {showExplainer && (
        <div
          onClick={() => setShowExplainer(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14,
              padding: '18px 18px 16px', maxWidth: 340, width: '100%', maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hoe werkt de score?</h3>
              <button
                onClick={() => setShowExplainer(false)}
                aria-label="Sluiten"
                style={{ fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--color-text)' }}>
              <p style={{ margin: '0 0 6px' }}>🌡 <strong>Temperatuur</strong> & 💨 <strong>wind</strong> — bepalen samen het grootste deel van de score. In instellingen kun je zelf kiezen wat zwaarder telt.</p>
              <p style={{ margin: '0 0 6px' }}>🌧 <strong>Regen</strong> — geen eigen laag, maar een grijze wasem over de score: hoe meer het regent en hoe zwaarder de bui, hoe donkerder (en lager de score).</p>
              <p style={{ margin: '0 0 6px' }}>☀️ <strong>Zon</strong> — een klein extra puntje bij helder weer overdag, telt niet zwaar.</p>
              <p style={{ margin: '0 0 6px' }}>🌙 <strong>Donker</strong> — 's nachts is de score altijd laag, wat het weer ook doet (zicht en veiligheid gaan voor).</p>
              <p style={{ margin: 0 }}>📡 <strong>2 bronnen</strong> — de score is een gemiddelde van KNMI en NOAA GFS. Zien ze het niet eens? Dan zie je een grijze stip.</p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, whiteSpace: 'nowrap',
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
        <SmoothChart days={data.days} field={activeField} showBreakdown={tab === 'fiets' && showBreakdown} windMode={windMode} />
        {tab === 'wind' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {WIND_MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setWindMode(m.key)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${windMode === m.key ? 'var(--color-text-muted)' : 'var(--color-border)'}`,
                  background: windMode === m.key ? 'var(--color-background)' : 'transparent',
                  color: windMode === m.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        {tab === 'fiets' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
            <button
              onClick={toggleBreakdown}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)',
              }}
            >
              {showBreakdown ? 'Met opbouw' : 'Simpel'}
            </button>
            {showBreakdown ? (
              <>
                <Legend color={BREAKDOWN_COLORS.temp} label="Temperatuur" />
                <Legend color={BREAKDOWN_COLORS.rain} label="Regen" />
                <Legend color={BREAKDOWN_COLORS.wind} label="Wind" />
                <Legend color={BREAKDOWN_COLORS.sun} label="Zon" />
              </>
            ) : (
              <Legend color={BREAKDOWN_COLORS.fiets} label="Score" />
            )}
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
