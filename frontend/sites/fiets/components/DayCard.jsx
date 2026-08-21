import { scoreColor } from '../scoreUtils.js'
import { daySummary } from '../format.js'
import { t, localeOf } from '../i18n.js'
import WindArrow from './WindArrow.jsx'

export default function DayCard({ day, lang, selected, onSelectBestMoment }) {
  const w = day.best_window
  const s = daySummary(day.hours)
  const dayLabel = new Date(day.date).toLocaleDateString(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div
      onClick={() => w && onSelectBestMoment?.(day, w)}
      title={w ? t(lang, 'showThisWindow') : undefined}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 12, padding: '10px 14px', cursor: w ? 'pointer' : 'default',
        borderLeft: `4px solid ${w ? scoreColor(w.avg_score) : 'var(--color-border)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{dayLabel}</div>
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
          <>
            {t(lang, 'bestMoment')}: <strong style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text)' }}>
              {w.start.slice(11, 16)}–{w.end.slice(11, 16)} · {w.avg_score} {t(lang, `tier.${w.score_tier}`).toLowerCase()} {t(lang, 'bikingWeather')}
            </strong>
          </>
        ) : (
          t(lang, 'noGoodMoment')
        )}
      </div>
    </div>
  )
}
