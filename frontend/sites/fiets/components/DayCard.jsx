import { scoreColor } from '../scoreUtils.js'
import { daySummary, degToCompass } from '../format.js'

export default function DayCard({ day }) {
  const w = day.best_window
  const s = daySummary(day.hours)
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '10px 14px',
      borderLeft: `4px solid ${w ? scoreColor(w.avg_score) : 'var(--color-border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{day.label}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span>🌡 {s.tempMin}–{s.tempMax}°C</span>
          <span>🌧 {s.rainProbMax}%</span>
          <span>💨 {s.windAvg} km/u {degToCompass(s.windDir)}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
        {w ? (
          <>Beste moment: <strong style={{ color: 'var(--color-text)' }}>{w.label}</strong></>
        ) : (
          'Geen goed moment overdag'
        )}
      </div>
    </div>
  )
}
