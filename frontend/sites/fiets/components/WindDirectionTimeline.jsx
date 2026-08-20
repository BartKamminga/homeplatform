import { useEffect, useState } from 'react'
import { BREAKDOWN_COLORS } from './SmoothChart.jsx'

// Zelfde CSS-var-resolutie als SmoothChart (var() in SVG-attributen bleek
// onbetrouwbaar, zie roadmap-toelichting bij dat component).
const THEME_VARS = ['--color-border', '--color-text', '--color-text-muted']
const FALLBACK_COLORS = {
  '--color-border': 'rgba(0,0,0,0.1)',
  '--color-text': '#1a1a1a',
  '--color-text-muted': 'rgba(26,26,26,0.55)',
}

function useThemeColors() {
  const [colors, setColors] = useState(FALLBACK_COLORS)
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const next = {}
      THEME_VARS.forEach(v => { next[v] = cs.getPropertyValue(v).trim() || FALLBACK_COLORS[v] })
      setColors(next)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return colors
}

const WIDTH = 720
const HEIGHT = 150
const PAD_TOP = 20
const PAD_BOTTOM = 36
const STEP_HOURS = 3 // elke 3 uur een pijl, anders te druk voor 72 uur in 720px

export default function WindDirectionTimeline({ days }) {
  const colors = useThemeColors()
  const hours = days.flatMap(d => d.hours)
  const n = hours.length
  if (n < 2) return null

  const rowY = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) / 2
  const xAt = i => (i / (n - 1)) * WIDTH

  const nightBands = []
  let bandStart = null
  hours.forEach((h, i) => {
    if (!h.is_daytime && bandStart === null) bandStart = i
    if (h.is_daytime && bandStart !== null) { nightBands.push([bandStart, i - 1]); bandStart = null }
  })
  if (bandStart !== null) nightBands.push([bandStart, n - 1])

  const dayTicks = []
  let offset = 0
  days.forEach(d => {
    dayTicks.push({ x: xAt(offset), label: new Date(d.date).toLocaleDateString('nl-NL', { weekday: 'short' }) })
    offset += d.hours.length
  })

  const arrowTicks = []
  for (let i = 0; i < n; i += STEP_HOURS) arrowTicks.push(i)

  const now = new Date()

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {nightBands.map(([s, e], i) => (
        <rect key={`night-${i}`} x={xAt(s)} y={PAD_TOP} width={Math.max(1, xAt(e) - xAt(s))} height={HEIGHT - PAD_TOP - PAD_BOTTOM}
          fill={colors['--color-border']} opacity={0.35} />
      ))}

      {arrowTicks.map(i => (
        <WindTick key={i} hour={hours[i]} x={xAt(i)} y={rowY} isNow={Math.abs(new Date(hours[i].time) - now) < STEP_HOURS * 1800 * 1000} colors={colors} />
      ))}

      {dayTicks.map((t, i) => (
        <g key={`day-${i}`}>
          {i > 0 && <line x1={t.x} y1={PAD_TOP} x2={t.x} y2={HEIGHT - PAD_BOTTOM} stroke={colors['--color-border']} strokeWidth={1} />}
          <text x={t.x + 4} y={HEIGHT - 6} fill={colors['--color-text']} style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</text>
        </g>
      ))}
    </svg>
  )
}

function WindTick({ hour, x, y, isNow, colors }) {
  const size = Math.min(16, 7 + hour.wind_kmh * 0.3)
  const travelDeg = (hour.wind_dir + 180) % 360

  return (
    <g opacity={hour.is_daytime ? 1 : 0.45}>
      {isNow && <circle cx={x} cy={y} r={14} fill="none" stroke={BREAKDOWN_COLORS.wind} strokeWidth={1} />}
      <g transform={`translate(${x},${y}) rotate(${travelDeg})`} stroke={BREAKDOWN_COLORS.wind} fill={BREAKDOWN_COLORS.wind}>
        <line x1={0} y1={size / 2} x2={0} y2={-size / 2} strokeWidth={2} strokeLinecap="round" />
        <path d={`M0,${-size / 2 - 3} L${-3},${-size / 2 + 3} L${3},${-size / 2 + 3} Z`} stroke="none" />
      </g>
      {hour.low_confidence && <circle cx={x} cy={y - 18} r={2} fill={colors['--color-text-muted']} />}
      <text x={x} y={y + 22} textAnchor="middle" fill={colors['--color-text']} style={{ fontSize: 9, fontWeight: 600 }}>{Math.round(hour.wind_kmh)}</text>
      <text x={x} y={y - 14} textAnchor="middle" fill={colors['--color-text-muted']} style={{ fontSize: 8 }}>{hour.time.slice(11, 16)}</text>
    </g>
  )
}
