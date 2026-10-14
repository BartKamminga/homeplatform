import { t, localeOf, scoreTierLabel } from '../i18n.js'
import { daySummary } from '../format.js'
import { AcDialog } from '@components/arcade/overlays.jsx'
import { tierColor, weightRows, up } from './tiers.js'
import { isoPlusHours } from './hooks/useForecast.js'

// Kaarten van de arcade-Prognose (item 1337): tijdvak-HUD, dagkaart en score-uitleg.

export function WindowCard({ lang, hours, avg, onNextBest, compact }) {
  if (!hours.length) return null
  const start = hours[0].time
  const end = isoPlusHours(hours[hours.length - 1].time, 1)
  const s = daySummary(hours)
  const color = tierColor(avg)
  const day = new Date(start).toLocaleDateString(localeOf(lang), { weekday: 'short' })
  return (
    <div className="ac-hud fa-window">
      <div>
        <span className="ac-label">{t(lang, 'tijdvakTitle')}</span>
        <div className="fa-score" style={{ color, textShadow: `0 0 16px ${color}` }}>{avg?.toFixed(1) ?? '–'}</div>
      </div>
      <div className="fa-window-mid">
        <span className="ac-label">{up(scoreTierLabel(lang, avg))}</span>
        <div className="fa-when">{up(day)} {start.slice(11, 16)} – {end.slice(11, 16)}</div>
        {!compact && (
          <div className="fa-window-meta">{s.tempMin}–{s.tempMax}° · {s.rainMm} MM · {s.windAvg} KM/H · {t(lang, 'dragHint')}</div>
        )}
      </div>
      <button type="button" className="ac-btn ac-btn--cyan ac-btn--sm" onClick={onNextBest} disabled={!onNextBest}
        title={t(lang, 'nextBestTooltip')}>
        NEXT ⏭
      </button>
    </div>
  )
}

export function DayCard({ day, lang, selected, onSelect }) {
  const w = day.best_window
  const s = daySummary(day.hours)
  const color = w ? tierColor(w.avg_score) : 'var(--ac-muted)'
  const label = new Date(day.date).toLocaleDateString(localeOf(lang), { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <button type="button" className={`ac-card fa-day${selected ? ' sel' : ''}`} style={{ '--c': color }}
      onClick={() => w && onSelect(day)} title={w ? t(lang, 'showThisWindow') : undefined} disabled={!w}>
      <header><b>{up(label)}</b><span>{w ? w.avg_score.toFixed(1) : '–'}</span></header>
      <div className="fa-stats">
        <div><small>TEMP</small>{s.tempMin}–{s.tempMax}°</div>
        <div><small>{up(t(lang, 'tab.zon'))}</small>{s.sunPct}%</div>
        <div><small>{up(t(lang, 'tab.rain'))}</small>{s.rainMm} mm</div>
        <div><small>WIND</small><span className="fa-arrow" style={{ transform: `rotate(${(s.windDir + 180) % 360}deg)` }}>↑</span> {s.windAvg}</div>
      </div>
      <div className="fa-best">
        {w ? <>{up(t(lang, 'bestMoment'))} <b>{w.start.slice(11, 16)}–{w.end.slice(11, 16)}</b> · {up(t(lang, `tier.${w.score_tier}`))}</>
          : up(t(lang, 'noGoodMoment'))}
      </div>
    </button>
  )
}

export function ScoreInfoDialog({ lang, weights, onClose, debug = false }) {
  const notes = debug ? { temp: 'debugWeightNote.temp', wind: 'debugWeightNote.wind' } : {}
  const rows = weightRows(lang, weights, notes)
  const maxPct = Math.max(...rows.map(r => r.pct)) || 1
  return (
    <AcDialog title={up(t(lang, 'howScoreWorks'))} tone="cyan" onClose={onClose}
      actions={<button type="button" className="ac-btn ac-btn--primary" onClick={onClose}>OK</button>}>
      <div className="ac-bars">
        {rows.map(r => (
          <div key={r.key}>
            <span className="lbl" style={{ color: r.color }}>{up(r.label)}</span>
            <span className="bar" style={{ '--c': r.color, width: `${r.pct / maxPct * 100}%` }} />
            <em>{r.pct}%</em>
          </div>
        ))}
      </div>
      {rows.map(r => <p key={r.key} className="ac-hint"><b style={{ color: r.color }}>{r.label}</b>: {r.note}</p>)}
      <p className="ac-hint"><b>{t(lang, 'daylightTitle')}</b>: {t(lang, debug ? 'daylightDebugExplain' : 'daylightExplain')}</p>
      {!debug && <p className="ac-hint"><b>{t(lang, 'sourcesTitle')}</b>: {t(lang, 'sourcesExplain')}</p>}
    </AcDialog>
  )
}
