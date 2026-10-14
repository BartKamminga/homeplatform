import { useId } from 'react'
import { t, localeOf } from '../../i18n.js'
import { FACTOR_COLOR } from '../tiers.js'
import { WIDTH, HEIGHT, PAD_TOP, PAD_BOTTOM, C, smoothPath, nowIndex, nightBands } from './geometry.js'
import { NightBands, HighlightBand, NowMarker, HourLabels, DayTicks, WindArrowMark } from './ChartParts.jsx'

// Neon-variant van SmoothChart (item 1337): zelfde velden, tijdvak-slepen, inzoomen en AI-lijn.
const RAIN_TIER_OPACITY = [0.08, 0.3, 0.6, 1]
const FIELD = {
  score:    { min: 0, max: 10, fmt: v => v.toFixed(1), color: C.yellow },
  temp:     { auto: true, pad: 1, fmt: v => `${Math.round(v)}°`, color: FACTOR_COLOR.temp },
  rain_mm:  { auto: true, min: 0, pad: 0.5, fmt: v => v.toFixed(1), color: C.cyan },
  wind_kmh: { auto: true, pad: 3, fmt: v => `${Math.round(v)}`, color: C.cyan },
  sun_pct:  { min: 0, max: 100, fmt: v => `${Math.round(v)}%`, color: C.yellow, get: h => h.is_daytime ? 100 - (h.cloud_cover ?? 0) : 0 },
}

export default function NeonChart({ days, field, breakdown = false, windMode = 'both', tijdvak, onTijdvakDrag, hourOffset = 0, lang, aiScores }) {
  const gid = useId().replace(/:/g, '')
  const hours = days.flatMap(d => d.hours)
  const n = hours.length
  if (n < 2) return null

  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const baseline = PAD_TOP + innerH
  const xAt = i => (i / (n - 1)) * WIDTH
  const bands = nightBands(hours)

  const dayTicks = []
  let offset = 0
  days.forEach(d => {
    const len = d.hours.length
    dayTicks.push({
      x: xAt(offset), centerX: xAt(offset + (len - 1) / 2),
      label: new Date(d.date).toLocaleDateString(localeOf(lang), { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase(),
    })
    offset += len
  })
  const step = n <= 24 ? 1 : 6
  const hourTicks = []
  for (let i = 0; i < n; i += step) hourTicks.push(i)

  const ni = nowIndex(hours)
  const nowX = ni == null ? null : xAt(ni)
  const ls = tijdvak ? tijdvak.startIdx - hourOffset : null
  const le = tijdvak ? tijdvak.endIdx - hourOffset : null
  const highlight = (le != null && le >= 0 && ls <= n - 1) ? [Math.max(0, ls), Math.min(n - 1, le)] : null
  const drag = (edge, idx) => onTijdvakDrag?.(edge, idx + hourOffset)
  const common = { xAt, bottom: baseline, n }

  const svgProps = { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, style: { width: '100%', height: 'auto', display: 'block' }, role: 'img', 'aria-label': field }

  if (field === 'score' && breakdown) {
    const keys = ['wind', 'sun', 'temp', 'rain']
    const scale = v => (v / 10) * innerH
    const layers = hours.map(h => keys.map(k => h.breakdown?.[`${k}_contrib`] ?? 0))
    const bounds = [hours.map(() => baseline)]
    for (let l = 0; l < 4; l++) bounds.push(hours.map((_, i) => bounds[l][i] - scale(layers[i][l])))
    return (
      <svg {...svgProps}>
        <NightBands bands={bands} xAt={xAt} innerH={innerH} />
        <HighlightBand range={highlight} {...common} onDrag={drag} />
        {keys.map((key, l) => {
          const lower = bounds[l].map((y, i) => [xAt(i), y])
          const upper = bounds[l + 1].map((y, i) => [xAt(i), y])
          const d = `${smoothPath(upper)} L ${xAt(n - 1)},${lower[n - 1][1]} ${smoothPath([...lower].reverse()).replace('M', 'L')} Z`
          return <path key={key} d={d} fill={FACTOR_COLOR[key]} fillOpacity={0.5} />
        })}
        <path d={smoothPath(bounds[4].map((y, i) => [xAt(i), y]))} fill="none" stroke={C.ink} strokeWidth={1.5} strokeOpacity={0.7} />
        <HourLabels hours={hours} hourTicks={hourTicks} xAt={xAt} yAt={i => bounds[4][i]} fmt={v => v.toFixed(1)} values={hours.map(h => h.score)} />
        <DayTicks dayTicks={dayTicks} baseline={baseline} />
        <NowMarker x={nowX} bottom={baseline} label={t(lang, 'now')} />
      </svg>
    )
  }

  const cfg = FIELD[field]
  const values = hours.map(cfg.get ?? (h => h[field]))
  const min = cfg.auto ? (cfg.min ?? Math.min(...values) - cfg.pad) : cfg.min
  const max = cfg.auto ? Math.max(...values) + cfg.pad : cfg.max
  const yAt = v => PAD_TOP + innerH - ((v - min) / (max - min || 1)) * innerH
  const line = smoothPath(values.map((v, i) => [xAt(i), yAt(v)]))
  const area = `${line} L ${xAt(n - 1)},${baseline} L ${xAt(0)},${baseline} Z`
  const isRain = field === 'rain_mm'
  const isWind = field === 'wind_kmh'
  const showLine = !isWind || windMode !== 'arrow'
  const showArrows = isWind && windMode !== 'chart'

  let aiLine = null
  if (field === 'score' && Array.isArray(aiScores) && aiScores.length) {
    const byTime = new Map(aiScores.map(a => [a.time, a.ai_score]))
    const pts = hours.map((h, i) => [i, byTime.get(h.time)]).filter(([, v]) => v != null).map(([i, v]) => [xAt(i), yAt(v)])
    if (pts.length >= 2) aiLine = smoothPath(pts)
  }

  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.color} stopOpacity=".35" /><stop offset="1" stopColor={C.pink} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={0} x2={WIDTH} y1={PAD_TOP + innerH * f} y2={PAD_TOP + innerH * f} stroke={C.grid} />)}
      <NightBands bands={bands} xAt={xAt} innerH={innerH} />
      <HighlightBand range={highlight} {...common} onDrag={drag} />
      {isRain
        ? hours.map((h, i) => h.rain_mm > 0 && (
            <rect key={i} x={xAt(i) - 3} y={yAt(h.rain_mm)} width={6} height={baseline - yAt(h.rain_mm)} rx={1}
              fill={C.cyan} fillOpacity={RAIN_TIER_OPACITY[h.rain_tier ?? 1]} />
          ))
        : showLine && <path d={area} fill={`url(#fill-${gid})`} />}
      {showLine && !isRain && (
        <path d={line} fill="none" stroke={cfg.color} strokeWidth={2.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${cfg.color})` }} />
      )}
      {aiLine && <path d={aiLine} fill="none" stroke={C.purple} strokeWidth={2} strokeDasharray="5,4" strokeLinecap="round" />}
      {showArrows && hourTicks.map(i => (
        <WindArrowMark key={`a-${i}`} x={xAt(i)} y={PAD_TOP + innerH / 2} deg={hours[i].wind_dir} kmh={values[i]}
          color={values[i] > 25 ? C.pink : C.ink} halo={showLine} />
      ))}
      <HourLabels hours={hours} hourTicks={hourTicks} xAt={xAt} values={values} fmt={cfg.fmt}
        yAt={i => showLine ? yAt(values[i]) : PAD_TOP + innerH / 2 + Math.min(32, 14 + values[i] * 0.6) / 2 + 16} />
      <DayTicks dayTicks={dayTicks} baseline={baseline} />
      <NowMarker x={nowX} bottom={baseline} label={t(lang, 'now')} />
    </svg>
  )
}
