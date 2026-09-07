import { useState } from 'react'
import { useThemeColors } from './chartTheme.js'

const WIDTH = 600
const LABEL_WIDTH = 170
const VALUE_WIDTH = 50
const GAP = 8
const PAD_LEFT = 8
const PAD_RIGHT = 8
const PAD_TOP = 6
const PAD_BOTTOM = 6
const ROW_HEIGHT = 28

// Ruwe tekens-per-px schatting voor de label-kolom (geen canvas-meting nodig
// voor dit soort interne admin-grafiekjes) - bij fontSize 12 past ongeveer
// 1 teken per 6.5px. Volledige tekst blijft altijd zichtbaar via de
// <title>-tooltip.
function truncateLabel(label, maxWidth) {
  const maxChars = Math.max(1, Math.floor(maxWidth / 6.5))
  if (label.length <= maxChars) return label
  return label.slice(0, Math.max(1, maxChars - 1)) + '…'
}

export default function RankingBarChart({ rows, limit = 12, colorFor, height }) {
  const colors = useThemeColors()
  const [hoverIdx, setHoverIdx] = useState(null)

  const displayRows = (Array.isArray(rows) ? rows : []).slice(0, limit)
  const isEmpty = displayRows.length === 0

  if (isEmpty) {
    return (
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 8, padding: '24px 16px',
        textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13,
      }}>
        No data
      </div>
    )
  }

  const chartHeight = height ?? displayRows.length * ROW_HEIGHT + PAD_TOP + PAD_BOTTOM
  const rowHeight = (chartHeight - PAD_TOP - PAD_BOTTOM) / displayRows.length
  const max = Math.max(1, ...displayRows.map(r => r.total || 0))

  const barAreaX = PAD_LEFT + LABEL_WIDTH + GAP
  const barAreaWidth = WIDTH - PAD_RIGHT - VALUE_WIDTH - GAP - barAreaX
  const defaultColor = colors['--color-primary']

  const hovered = hoverIdx != null ? displayRows[hoverIdx] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${chartHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {displayRows.map((row, i) => {
          const y = PAD_TOP + i * rowHeight
          const barH = rowHeight * 0.55
          const barY = y + (rowHeight - barH) / 2
          const barW = Math.max(row.total > 0 ? 2 : 0, (row.total / max) * barAreaWidth)
          const color = colorFor ? colorFor(row) : defaultColor
          const label = truncateLabel(row.label ?? '', LABEL_WIDTH)
          return (
            <g key={i}
              onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'default' }}
            >
              <title>{`${row.label}: ${row.total}`}</title>
              <rect x={0} y={y} width={WIDTH} height={rowHeight}
                fill={hoverIdx === i ? colors['--color-border'] : 'transparent'} opacity={0.4} />
              <text x={PAD_LEFT} y={y + rowHeight / 2 + 4} fill={colors['--color-text']} style={{ fontSize: 12 }}>
                {label}
              </text>
              <rect x={barAreaX} y={barY} width={barAreaWidth} height={barH} fill={colors['--color-border']} opacity={0.3} rx={3} />
              <rect x={barAreaX} y={barY} width={barW} height={barH} fill={color} rx={3} />
              <text x={WIDTH - PAD_RIGHT} y={y + rowHeight / 2 + 4} textAnchor="end" fill={colors['--color-text']} style={{ fontSize: 12, fontWeight: 600 }}>
                {row.total}
              </text>
            </g>
          )
        })}
      </svg>

      {hovered && (
        <div style={{
          position: 'absolute', top: PAD_TOP + hoverIdx * rowHeight, left: `${(barAreaX / WIDTH) * 100}%`,
          transform: 'translate(0, -100%)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6,
          padding: '5px 9px', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontWeight: 600 }}>{hovered.label}</div>
          <div style={{ color: 'var(--color-text-muted)' }}>
            {hovered.total}{hovered.target_type ? ` — ${hovered.target_type}` : ''}
          </div>
        </div>
      )}

      <details style={{ marginTop: 6, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>Table view</summary>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, marginTop: 6 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>Label</th>
              <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>{row.label}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
