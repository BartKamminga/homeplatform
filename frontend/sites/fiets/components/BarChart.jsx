import { useEffect, useState } from 'react'
import { scoreColorVar } from '../scoreUtils.js'

// CSS-variabelen worden hier op runtime opgelost naar echte kleurwaarden i.p.v.
// via var(...) in SVG-attributen te verwijzen — dat bleek in de praktijk niet
// betrouwbaar te resolven, waardoor lijnen/balken onzichtbaar bleven.
const THEME_VARS = [
  '--color-primary', '--color-border', '--color-text', '--color-text-muted',
  '--color-success', '--color-warning', '--color-danger',
]

function useThemeColors() {
  const [colors, setColors] = useState({})
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const next = {}
    THEME_VARS.forEach(v => { next[v] = cs.getPropertyValue(v).trim() })
    setColors(next)
  }, [])
  return colors
}

const FIELD_CONFIG = {
  score:     { min: 0, max: 10,  fmt: v => v.toFixed(1) },
  temp:      { auto: true, pad: 1, fmt: v => `${Math.round(v)}°` },
  rain_prob: { min: 0, max: 100, fmt: v => `${Math.round(v)}%` },
  wind_kmh:  { auto: true, pad: 3, fmt: v => `${Math.round(v)}` },
}

const WIDTH = 720
const HEIGHT = 170
const PAD_TOP = 20
const PAD_BOTTOM = 42
const HOUR_TICK_STEP = 6

export default function BarChart({ days, field }) {
  const colors = useThemeColors()
  const hours = days.flatMap(d => d.hours)
  const n = hours.length
  if (n < 2 || !colors['--color-border']) return null

  const values = hours.map(h => h[field])
  const cfg = FIELD_CONFIG[field]
  const min = cfg.auto ? Math.min(...values) - cfg.pad : cfg.min
  const max = cfg.auto ? Math.max(...values) + cfg.pad : cfg.max
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const baseline = PAD_TOP + innerH

  const slotW = WIDTH / n
  const barW = slotW * 0.7
  const xAt = i => i * slotW
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

  // Uur-ticks elke 6 uur, met de waarde erboven — zoals Google's neerslag-balkjes
  const hourTicks = []
  for (let i = 0; i < n; i += HOUR_TICK_STEP) {
    hourTicks.push({ i, x: xAt(i) + barW / 2 })
  }

  const barColor = i => field === 'score' ? colors[scoreColorVar(values[i])] : colors['--color-primary']

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {nightBands.map(([s, e], i) => (
        <rect
          key={`night-${i}`}
          x={xAt(s)} y={PAD_TOP} width={Math.max(1, xAt(e + 1) - xAt(s))} height={innerH}
          fill={colors['--color-border']} opacity={0.35}
        />
      ))}

      {values.map((v, i) => (
        <rect
          key={`bar-${i}`}
          x={xAt(i) + (slotW - barW) / 2} y={yAt(v)}
          width={barW} height={Math.max(1, baseline - yAt(v))}
          fill={barColor(i)} rx={1}
        />
      ))}

      {hourTicks.map((t, i) => (
        <g key={`hour-${i}`}>
          <text x={t.x} y={Math.max(11, yAt(values[t.i]) - 5)} textAnchor="middle" fill={colors['--color-text']} style={{ fontSize: 10, fontWeight: 600 }}>
            {cfg.fmt(values[t.i])}
          </text>
          <text x={t.x} y={HEIGHT - PAD_BOTTOM + 16} textAnchor="middle" fill={colors['--color-text-muted']} style={{ fontSize: 9 }}>
            {hours[t.i].time.slice(11, 16)}
          </text>
        </g>
      ))}

      {dayTicks.map((t, i) => (
        <g key={`day-${i}`}>
          {i > 0 && (
            <line x1={t.x} y1={PAD_TOP} x2={t.x} y2={baseline} stroke={colors['--color-border']} strokeWidth={1} />
          )}
          <text x={t.x + 4} y={HEIGHT - 6} fill={colors['--color-text']} style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</text>
        </g>
      ))}
    </svg>
  )
}
