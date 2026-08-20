import WindArrow from './WindArrow.jsx'

const STEP_HOURS = 3 // elke 3 uur een pijl, anders te druk voor 72 uur in beeld

export default function WindDirectionTimeline({ days }) {
  const now = new Date()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {days.map(day => {
        const ticks = day.hours.filter((_, i) => i % STEP_HOURS === 0)
        return (
          <div key={day.date}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>{day.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {ticks.map(h => {
                const isNow = Math.abs(new Date(h.time) - now) < STEP_HOURS * 3600 * 1000 / 2
                return (
                  <div key={h.time} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '6px 8px', borderRadius: 10, minWidth: 44,
                    background: isNow ? 'var(--color-surface)' : 'transparent',
                    border: isNow ? '1px solid var(--color-primary)' : '1px solid transparent',
                    opacity: h.is_daytime ? 1 : 0.5,
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{h.time.slice(11, 16)}</span>
                    <WindArrow deg={h.wind_dir} kmh={h.wind_kmh} />
                    <span style={{ fontSize: 10, color: 'var(--color-text)' }}>{Math.round(h.wind_kmh)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
