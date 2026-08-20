import { scoreColor } from '../scoreUtils.js'

const FIELD_CONFIG = {
  score:     { min: 0, max: 10 },
  temp:      { auto: true, pad: 1 },
  rain_prob: { min: 0, max: 100 },
  wind_kmh:  { auto: true, pad: 3 },
}

const WIDTH = 720
const HEIGHT = 170
const PAD_TOP = 12
const PAD_BOTTOM = 42
const HOUR_TICK_STEP = 6

export default function LineGraph({ days, field }) {
  const hours = days.flatMap(d => d.hours)
  const n = hours.length
  if (n < 2) return null

  const values = hours.map(h => h[field])
  const cfg = FIELD_CONFIG[field]
  const min = cfg.auto ? Math.min(...values) - cfg.pad : cfg.min
  const max = cfg.auto ? Math.max(...values) + cfg.pad : cfg.max
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM

  const xAt = i => (i / (n - 1)) * WIDTH
  const yAt = v => PAD_TOP + innerH - ((v - min) / (max - min || 1)) * innerH

  // Samenhangende reeksen nachturen (voor de uitgegrijsde achtergrondbanden)
  const nightBands = []
  let bandStart = null
  hours.forEach((h, i) => {
    if (!h.is_daytime && bandStart === null) bandStart = i
    if (h.is_daytime && bandStart !== null) { nightBands.push([bandStart, i - 1]); bandStart = null }
  })
  if (bandStart !== null) nightBands.push([bandStart, n - 1])

  // Dag-grenzen: label bij het eerste uur van elke dag
  const dayTicks = []
  let offset = 0
  days.forEach(d => {
    dayTicks.push({ x: xAt(offset), label: new Date(d.date).toLocaleDateString('nl-NL', { weekday: 'short' }) })
    offset += d.hours.length
  })

  // Uur-ticks elke 6 uur (00:00/06:00/12:00/18:00), zoals de Google Weer-tijdlijn
  const hourTicks = []
  for (let i = 0; i < n; i += HOUR_TICK_STEP) {
    hourTicks.push({ x: xAt(i), label: hours[i].time.slice(11, 16) })
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {nightBands.map(([s, e], i) => (
        <rect
          key={`night-${i}`}
          x={xAt(s)} y={0} width={Math.max(1, xAt(e) - xAt(s))} height={HEIGHT - PAD_BOTTOM}
          style={{ fill: 'var(--color-border)', opacity: 0.35 }}
        />
      ))}

      {field === 'score' ? (
        hours.slice(0, -1).map((_, i) => (
          <line
            key={`seg-${i}`}
            x1={xAt(i)} y1={yAt(values[i])} x2={xAt(i + 1)} y2={yAt(values[i + 1])}
            style={{ stroke: scoreColor((values[i] + values[i + 1]) / 2), strokeWidth: 3, strokeLinecap: 'round' }}
          />
        ))
      ) : (
        <polyline
          points={values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
          style={{ fill: 'none', stroke: 'var(--color-primary)', strokeWidth: 2.5 }}
        />
      )}

      {hourTicks.map((t, i) => (
        <g key={`hour-${i}`}>
          <line x1={t.x} y1={HEIGHT - PAD_BOTTOM} x2={t.x} y2={HEIGHT - PAD_BOTTOM + 4} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          <text x={t.x} y={HEIGHT - PAD_BOTTOM + 16} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--color-text-muted)' }}>{t.label}</text>
        </g>
      ))}

      {dayTicks.map((t, i) => (
        <g key={`day-${i}`}>
          {i > 0 && (
            <line x1={t.x} y1={0} x2={t.x} y2={HEIGHT - PAD_BOTTOM} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          )}
          <text x={t.x + 4} y={HEIGHT - 6} style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-text)' }}>{t.label}</text>
        </g>
      ))}
    </svg>
  )
}
