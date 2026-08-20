import { scoreColor } from '../scoreUtils.js'

export default function BestMomentChip({ day }) {
  const w = day.best_window
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '10px 14px',
      borderLeft: `4px solid ${w ? scoreColor(w.avg_score) : 'var(--color-border)'}`,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, minWidth: 96, flexShrink: 0 }}>{day.label}</div>
      {w ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Beste moment: <strong style={{ color: 'var(--color-text)' }}>{w.label}</strong>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen goed moment overdag</div>
      )}
    </div>
  )
}
