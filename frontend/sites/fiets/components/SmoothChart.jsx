import { useEffect, useState } from 'react'

// CSS-variabelen worden hier op runtime opgelost naar echte kleurwaarden i.p.v.
// via var(...) in SVG-attributen te verwijzen — dat bleek in de praktijk niet
// betrouwbaar te resolven, waardoor de grafiek onzichtbaar bleef.
const THEME_VARS = ['--color-primary', '--color-border', '--color-text', '--color-text-muted']

// Fallback als /core/theme.css niet laadt (bekend probleem, zie roadmap) —
// zonder dit blijven de CSS-variabelen leeg en rendert de grafiek niets.
const FALLBACK_COLORS = {
  '--color-primary': '#ff3e6c',
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

// Factor-kleuren voor de gestapelde Fiets-vlakken (welk deel komt van
// regen-blokkade/temperatuur/wind/zon) — eigen kleine palet, geen thema-var
// voorhanden hiervoor.
export const BREAKDOWN_COLORS = { rain: '#94a3b8', temp: '#f97316', wind: '#3b82f6', sun: '#eab308', fiets: '#22c55e' }

// Zelfde kleuren als de Fiets-legenda, ook voor de losse metriek-grafieken
// (item 788): Temperatuur=oranje, Wind=blauw, Neerslagkans=grijs (regen-kleur), Zon=geel.
const FIELD_COLOR = {
  temp: BREAKDOWN_COLORS.temp, rain_prob: BREAKDOWN_COLORS.rain,
  wind_kmh: BREAKDOWN_COLORS.wind, sun_pct: BREAKDOWN_COLORS.sun,
}

const FIELD_CONFIG = {
  score:     { min: 0, max: 10,  fmt: v => v.toFixed(1) },
  temp:      { auto: true, pad: 1, fmt: v => `${Math.round(v)}°` },
  rain_prob: { min: 0, max: 100, fmt: v => `${Math.round(v)}%` },
  wind_kmh:  { auto: true, pad: 3, fmt: v => `${Math.round(v)}` },
  sun_pct:   { min: 0, max: 100, fmt: v => `${Math.round(v)}%`, get: h => 100 - (h.cloud_cover ?? 0) },
}

const WIDTH = 720
const HEIGHT = 170
const PAD_TOP = 22
const PAD_BOTTOM = 42
const HOUR_TICK_STEP = 6

// Vloeiende curve door een reeks punten (quadratic-Bezier door de midpunten,
// zoals de Google Weer-referentie) — geen chart-library nodig voor dit effect.
function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    d += ` Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
  }
  const [lx, ly] = points[points.length - 1]
  d += ` T ${lx},${ly}`
  return d
}

// Fractionele positie (uur-index) van "nu" binnen de uren-array, voor de
// tijd-indicator op de tijdlijn (item 787). null als "nu" buiten bereik valt.
function nowIndex(hours) {
  const now = new Date()
  const first = new Date(hours[0].time)
  const last = new Date(hours[hours.length - 1].time)
  if (now < first || now > last) return null
  for (let i = 0; i < hours.length - 1; i++) {
    const t0 = new Date(hours[i].time)
    const t1 = new Date(hours[i + 1].time)
    if (now >= t0 && now <= t1) return i + (now - t0) / (t1 - t0)
  }
  return hours.length - 1
}

function NowMarker({ x, top, bottom, colors }) {
  if (x == null) return null
  return (
    <g>
      <line x1={x} y1={top} x2={x} y2={bottom} stroke={colors['--color-text']} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
      <text x={x} y={top - 6} textAnchor="middle" fill={colors['--color-text']} style={{ fontSize: 9, fontWeight: 700 }}>nu</text>
    </g>
  )
}

export default function SmoothChart({ days, field, showBreakdown = true }) {
  const colors = useThemeColors()
  const hours = days.flatMap(d => d.hours)
  const n = hours.length
  if (n < 2) return null

  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const baseline = PAD_TOP + innerH
  const xAt = i => (i / (n - 1)) * WIDTH

  // Samenhangende reeksen nachturen (voor de uitgegrijsde achtergrondbanden)
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

  const hourTicks = []
  for (let i = 0; i < n; i += HOUR_TICK_STEP) hourTicks.push(i)

  const nowX = (() => { const ni = nowIndex(hours); return ni == null ? null : xAt(ni) })()

  if (field === 'score' && showBreakdown) {
    return (
      <ScoreArea
        hours={hours} n={n} xAt={xAt} baseline={baseline} innerH={innerH}
        nightBands={nightBands} dayTicks={dayTicks} hourTicks={hourTicks} colors={colors} nowX={nowX}
      />
    )
  }

  const cfg = FIELD_CONFIG[field]
  const values = hours.map(cfg.get ?? (h => h[field]))
  const min = cfg.auto ? Math.min(...values) - cfg.pad : cfg.min
  const max = cfg.auto ? Math.max(...values) + cfg.pad : cfg.max
  const yAt = v => PAD_TOP + innerH - ((v - min) / (max - min || 1)) * innerH
  const lineColor = field === 'score' ? BREAKDOWN_COLORS.fiets : (FIELD_COLOR[field] || colors['--color-primary'])

  const points = values.map((v, i) => [xAt(i), yAt(v)])
  const linePath = smoothPath(points)
  const areaPath = `${linePath} L ${xAt(n - 1)},${baseline} L ${xAt(0)},${baseline} Z`

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {nightBands.map(([s, e], i) => (
        <rect key={`night-${i}`} x={xAt(s)} y={PAD_TOP} width={Math.max(1, xAt(e) - xAt(s))} height={innerH}
          fill={colors['--color-border']} opacity={0.35} />
      ))}
      <path d={areaPath} fill={lineColor} opacity={0.15} />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" />
      {hours.map((h, i) => h.low_confidence && (
        <circle key={`lc-${i}`} cx={xAt(i)} cy={PAD_TOP - 10} r={2} fill={colors['--color-text-muted']} />
      ))}
      <HourLabels hours={hours} hourTicks={hourTicks} xAt={xAt} yAt={i => yAt(values[i])} fmt={v => cfg.fmt(v)} values={values} colors={colors} />
      <DayTicks dayTicks={dayTicks} baseline={baseline} colors={colors} />
      <NowMarker x={nowX} top={PAD_TOP} bottom={baseline} colors={colors} />
    </svg>
  )
}

function ScoreArea({ hours, n, xAt, baseline, innerH, nightBands, dayTicks, hourTicks, colors, nowX }) {
  const scale = v => (v / 10) * innerH // score/contributies zitten al op de 0-10 schaal

  // Gestapeld van onder naar boven: regen-blokkade, temperatuur, wind, zon.
  const layerValues = hours.map(h => h.breakdown?.rain_gated
    ? [h.score, 0, 0, 0]
    : [0, h.breakdown?.temp_contrib ?? 0, h.breakdown?.wind_contrib ?? 0, h.breakdown?.sun_bonus ?? 0])

  const boundaries = [hours.map(() => baseline)] // onderste grens = baseline
  for (let layer = 0; layer < 4; layer++) {
    const prev = boundaries[layer]
    boundaries.push(hours.map((_, i) => prev[i] - scale(layerValues[i][layer])))
  }

  const keys = ['rain', 'temp', 'wind', 'sun']
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {nightBands.map(([s, e], i) => (
        <rect key={`night-${i}`} x={xAt(s)} y={PAD_TOP} width={Math.max(1, xAt(e) - xAt(s))} height={innerH}
          fill={colors['--color-border']} opacity={0.35} />
      ))}

      {keys.map((key, layer) => {
        const lower = boundaries[layer].map((y, i) => [xAt(i), y])
        const upper = boundaries[layer + 1].map((y, i) => [xAt(i), y])
        const d = `${smoothPath(upper)} L ${xAt(n - 1)},${lower[n - 1][1]} ${
          smoothPath([...lower].reverse()).replace('M', 'L')
        } Z`
        return <path key={key} d={d} fill={BREAKDOWN_COLORS[key]} opacity={key === 'rain' ? 0.7 : 0.85} />
      })}

      <path d={smoothPath(boundaries[4].map((y, i) => [xAt(i), y]))} fill="none" stroke={colors['--color-text']} strokeWidth={1.5} opacity={0.5} />

      {hours.map((h, i) => h.low_confidence && (
        <circle key={`lc-${i}`} cx={xAt(i)} cy={PAD_TOP - 10} r={2} fill={colors['--color-text-muted']} />
      ))}

      <HourLabels hours={hours} hourTicks={hourTicks} xAt={xAt} yAt={i => boundaries[4][i]} fmt={v => v.toFixed(1)} values={hours.map(h => h.score)} colors={colors} />
      <DayTicks dayTicks={dayTicks} baseline={baseline} colors={colors} />
      <NowMarker x={nowX} top={PAD_TOP} bottom={baseline} colors={colors} />
    </svg>
  )
}

function HourLabels({ hourTicks, xAt, yAt, fmt, values, hours, colors }) {
  return hourTicks.map(i => (
    <g key={`hour-${i}`}>
      <text x={xAt(i)} y={Math.max(11, yAt(i) - 8)} textAnchor="middle" fill={colors['--color-text']} style={{ fontSize: 10, fontWeight: 600 }}>
        {fmt(values[i])}
      </text>
      <text x={xAt(i)} y={HEIGHT - PAD_BOTTOM + 16} textAnchor="middle" fill={colors['--color-text-muted']} style={{ fontSize: 9 }}>
        {(hours ?? [])[i]?.time?.slice(11, 16)}
      </text>
    </g>
  ))
}

function DayTicks({ dayTicks, baseline, colors }) {
  return dayTicks.map((t, i) => (
    <g key={`day-${i}`}>
      {i > 0 && <line x1={t.x} y1={PAD_TOP} x2={t.x} y2={baseline} stroke={colors['--color-border']} strokeWidth={1} />}
      <text x={t.x + 4} y={HEIGHT - 6} fill={colors['--color-text']} style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</text>
    </g>
  ))
}
