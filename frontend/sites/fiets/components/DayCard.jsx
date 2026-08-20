import { scoreColor } from '../scoreUtils.js'
import { daySummary } from '../format.js'
import WindArrow from './WindArrow.jsx'

export default function DayCard({ day, selected, onSelectBestMoment }) {
  const w = day.best_window
  const s = daySummary(day.hours)
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 12, padding: '10px 14px',
      borderLeft: `4px solid ${w ? scoreColor(w.avg_score) : 'var(--color-border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{day.label}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span>🌡 {s.tempMin}–{s.tempMax}°C</span>
          <span>☀️ {s.sunPct}%</span>
          <span>🌧 {s.rainMm}mm</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <WindArrow deg={s.windDir} kmh={s.windAvg} />
            {s.windAvg} km/u
          </span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
        {w ? (
          <button
            onClick={() => onSelectBestMoment?.(day, w)}
            title="Toon dit tijdvak in de grafiek"
            style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, color: 'var(--color-text-muted)', textDecoration: selected ? 'none' : 'underline',
              textDecorationStyle: 'dotted',
            }}
          >
            Beste moment: <strong style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text)' }}>{w.label}</strong>
          </button>
        ) : (
          'Geen goed moment gevonden'
        )}
      </div>
    </div>
  )
}
