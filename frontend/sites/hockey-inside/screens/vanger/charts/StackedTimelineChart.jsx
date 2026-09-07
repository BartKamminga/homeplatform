import { useState } from 'react'
import { REASON_META } from '../reasonMeta.js'
import { useThemeColors, NEUTRAL_COLOR } from './chartTheme.js'

// Max aantal individuele series in de stack (excl. "Other") - erboven wordt
// gefold in 1 grijze "Other"-groep, gesorteerd op totaalvolume over alle
// buckets heen (niet per bucket) zodat de fold stabiel is over de hele
// tijdlijn. Vaste projectconventie: cap op ~4-5 gelijktijdige series.
const MAX_INDIVIDUAL_SERIES = 4

const WIDTH = 600
const PAD_LEFT = 40
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 30

function reasonLabel(key) { return REASON_META[key]?.label || key }
function reasonColor(key) { return REASON_META[key]?.color || NEUTRAL_COLOR }

function sumFold(byReason, foldKeys) {
  return foldKeys.reduce((sum, k) => sum + (byReason?.[k] || 0), 0)
}

// Bepaalt de vaste series-volgorde (en de "Other"-fold) op basis van het
// totaalvolume per reason over ALLE buckets - dit bepaalt zowel de
// stapelvolgorde als de legenda, en blijft dus consistent per render.
function buildSeries(buckets, reasonsPresent) {
  const totals = {}
  ;(reasonsPresent || []).forEach(r => { totals[r] = 0 })
  buckets.forEach(b => {
    Object.entries(b.by_reason || {}).forEach(([r, v]) => {
      totals[r] = (totals[r] || 0) + (v || 0)
    })
  })
  const ordered = Object.keys(totals).sort((a, b) => totals[b] - totals[a])

  if (ordered.length <= MAX_INDIVIDUAL_SERIES + 1) {
    return ordered.map(r => ({ key: r, label: reasonLabel(r), color: reasonColor(r), fold: [r] }))
  }
  const head = ordered.slice(0, MAX_INDIVIDUAL_SERIES)
  const tail = ordered.slice(MAX_INDIVIDUAL_SERIES)
  return [
    ...head.map(r => ({ key: r, label: reasonLabel(r), color: reasonColor(r), fold: [r] })),
    { key: '__other__', label: 'Other', color: NEUTRAL_COLOR, fold: tail },
  ]
}

export default function StackedTimelineChart({ buckets, reasonsPresent, height = 240, onHoverBucket }) {
  const colors = useThemeColors()
  const [hoverIdx, setHoverIdx] = useState(null)

  const safeBuckets = Array.isArray(buckets) ? buckets : []
  const series = buildSeries(safeBuckets, reasonsPresent || [])

  const bucketTotals = safeBuckets.map(b => b.total ?? Object.values(b.by_reason || {}).reduce((s, v) => s + (v || 0), 0))
  const rawMax = Math.max(0, ...bucketTotals)

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT
  const innerH = height - PAD_TOP - PAD_BOTTOM
  const baseline = PAD_TOP + innerH
  const n = safeBuckets.length
  const slot = n > 0 ? innerW / n : innerW
  const barWidth = Math.max(1, slot * 0.6)

  // Om de zoveelste bucket een x-label tonen zodra er te veel buckets zijn
  // om ze allemaal leesbaar te labelen (zelfde idee als hourTickStep in
  // SmoothChart.jsx).
  const labelStep = n > 14 ? Math.ceil(n / 14) : 1

  function handleEnter(i) { setHoverIdx(i); onHoverBucket?.(safeBuckets[i]) }
  function handleLeave() { setHoverIdx(null); onHoverBucket?.(null) }

  const isEmpty = n === 0 || rawMax === 0

  const columns = !isEmpty && safeBuckets.map((b, i) => {
    let cum = 0
    const segs = series.map(s => {
      const value = sumFold(b.by_reason, s.fold)
      const y0 = baseline - (cum / rawMax) * innerH
      cum += value
      const y1 = baseline - (cum / rawMax) * innerH
      return { ...s, value, y0, y1 }
    })
    return { bucket: b, x: PAD_LEFT + i * slot + (slot - barWidth) / 2, segs, total: bucketTotals[i] }
  })

  const yTicks = [0, 0.5, 1].map(f => Math.round(rawMax * f))
  const hovered = hoverIdx != null && columns ? columns[hoverIdx] : null
  const tooltipLeftPct = hovered ? ((hovered.x + barWidth / 2) / WIDTH) * 100 : 0

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={baseline} stroke={colors['--color-border']} strokeWidth={1} />
        <line x1={PAD_LEFT} y1={baseline} x2={WIDTH - PAD_RIGHT} y2={baseline} stroke={colors['--color-border']} strokeWidth={1} />

        {!isEmpty && yTicks.map((v, i) => {
          const y = baseline - (v / rawMax) * innerH
          return (
            <g key={`ytick-${i}`}>
              <line x1={PAD_LEFT - 4} y1={y} x2={WIDTH - PAD_RIGHT} y2={y} stroke={colors['--color-border']} strokeWidth={0.5} opacity={0.5} />
              <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fill={colors['--color-text-muted']} style={{ fontSize: 9 }}>{v}</text>
            </g>
          )
        })}

        {isEmpty ? (
          <text x={WIDTH / 2} y={PAD_TOP + innerH / 2} textAnchor="middle" fill={colors['--color-text-muted']} style={{ fontSize: 12 }}>
            No scan activity
          </text>
        ) : columns.map((col, i) => (
          <g key={col.bucket.bucket ?? i}
            onMouseEnter={() => handleEnter(i)} onMouseLeave={handleLeave}
            style={{ cursor: 'pointer' }}
          >
            {/* Onzichtbare volledige-hoogte hit-target, groter dan de smalle staaf zelf. */}
            <rect x={PAD_LEFT + i * slot} y={PAD_TOP} width={slot} height={innerH} fill="transparent" />
            {col.segs.filter(s => s.value > 0).map(s => (
              <rect key={s.key} x={col.x} y={s.y1} width={barWidth} height={Math.max(0.5, s.y0 - s.y1)}
                fill={s.color} stroke={colors['--color-surface']} strokeWidth={0.5}
                opacity={hoverIdx == null || hoverIdx === i ? 1 : 0.45} />
            ))}
            {i % labelStep === 0 && (
              <text x={col.x + barWidth / 2} y={baseline + 14} textAnchor="middle" fill={colors['--color-text-muted']} style={{ fontSize: 9 }}>
                {col.bucket.bucket}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hovered && (
        <div style={{
          position: 'absolute', top: PAD_TOP, left: `${tooltipLeftPct}%`, transform: 'translate(-50%, 0)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6,
          padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{hovered.bucket.bucket} — {hovered.total}</div>
          {hovered.segs.filter(s => s.value > 0).map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              <span style={{ color: 'var(--color-text-muted)' }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {!isEmpty && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, fontSize: 11 }}>
          {series.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              <span style={{ color: 'var(--color-text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <details style={{ marginTop: 6, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>Table view</summary>
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>Bucket</th>
                {series.map(s => (
                  <th key={s.key} style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>{s.label}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {safeBuckets.length === 0 ? (
                <tr><td colSpan={series.length + 2} style={{ padding: '8px', color: 'var(--color-text-muted)' }}>No data</td></tr>
              ) : safeBuckets.map((b, i) => (
                <tr key={b.bucket ?? i}>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>{b.bucket}</td>
                  {series.map(s => (
                    <td key={s.key} style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
                      {sumFold(b.by_reason, s.fold)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                    {bucketTotals[i]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
