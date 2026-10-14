import { useState } from 'react'
import { t } from '../i18n.js'
import { AcTabs, AcSeg } from '@components/arcade/controls.jsx'
import NeonChart from './chart/NeonChart.jsx'
import { WindowCard, DayCard, ScoreInfoDialog } from './ForecastCards.jsx'
import { useForecast } from './hooks/useForecast.js'
import { FACTOR_COLOR, up } from './tiers.js'

// Prognose-scherm van de arcade-variant (item 1337).
const TABS = ['fiets', 'temp', 'rain', 'wind', 'zon']
const TAB_FIELD = { fiets: 'score', temp: 'temp', rain: 'rain_mm', wind: 'wind_kmh', zon: 'sun_pct' }
const SOURCES = [{ value: 'knmi', label: 'KNMI' }, { value: 'gfs', label: 'GFS' }, { value: 'icon', label: 'ICON' }]

function Legend({ items }) {
  return (
    <div className="fa-legend">
      {items.map(([label, color, op]) => <span key={label}><i style={{ '--c': color, opacity: op ?? 1 }} />{up(label)}</span>)}
    </div>
  )
}

export default function ForecastView({ lang }) {
  const f = useForecast()
  const [tab, setTab] = useState('fiets')
  const [windMode, setWindMode] = useState('arrow')
  const [info, setInfo] = useState(false)

  if (f.loading) return <div className="ac-state"><div className="ac-big-msg ac-blink">{up(t(lang, 'loading'))}</div></div>
  if (f.error || f.data?.status === 'error') return (
    <div className="ac-state"><div className="ac-big-msg" style={{ color: 'var(--ac-pink)' }}>NO SIGNAL</div><p className="ac-hint">{t(lang, 'weatherUnavailable')}</p></div>
  )
  if (!f.data || f.data.days.length === 0) return (
    <div className="ac-state"><div className="ac-big-msg">NO DATA</div><p className="ac-hint">{t(lang, 'emptyState')}</p></div>
  )

  const field = TAB_FIELD[tab]
  return (
    <div className="fa-body">
      <div className="fa-loc">
        <span className="ac-label" style={{ margin: 0 }}>LOC</span>
        <b>{up(f.data.location?.label ?? '')}</b>
        <button type="button" className="ac-icon" aria-label={t(lang, 'howScoreWorks')} onClick={() => setInfo(true)}>i</button>
        {f.dayFilter && <button type="button" className="ac-btn ac-btn--sm" onClick={() => f.setDayFilter(null)}>{up(t(lang, 'backToAllDays'))}</button>}
      </div>

      <AcTabs scroll value={tab} onChange={setTab} items={TABS.map(k => ({ value: k, label: up(t(lang, `tab.${k}`)) }))} />

      <div className="ac-card fa-chart">
        <NeonChart days={f.displayedDays} field={field} breakdown={tab === 'fiets' && f.showBreakdown} windMode={windMode}
          tijdvak={f.tijdvak} onTijdvakDrag={f.dragTijdvak} hourOffset={f.hourOffset} lang={lang}
          aiScores={field === 'score' ? f.aiScores : null} />
        <div className="fa-info">
          <div className="fa-info-left">
            {tab === 'fiets' && <>
              <AcSeg value={f.showBreakdown} onChange={f.setBreakdown}
                items={[{ value: false, label: up(t(lang, 'simple')) }, { value: true, label: up(t(lang, 'withBreakdown')) }]} />
              {f.showBreakdown
                ? <Legend items={['rain', 'temp', 'sun', 'wind'].map(k => [t(lang, `weight.${k}`), FACTOR_COLOR[k]])} />
                : <Legend items={[[t(lang, 'legend.score'), 'var(--ac-yellow)'], ['AI', 'var(--ac-purple)'], [t(lang, 'tijdvakTitle'), 'var(--ac-cyan)']]} />}
            </>}
            {tab === 'wind' && <AcSeg value={windMode} onChange={setWindMode}
              items={['chart', 'arrow', 'both'].map(k => ({ value: k, label: up(t(lang, `windMode.${k}`)) }))} />}
            {tab === 'rain' && <Legend items={[[t(lang, 'legend.light'), 'var(--ac-cyan)', 0.3], [t(lang, 'legend.moderate'), 'var(--ac-cyan)', 0.6], [t(lang, 'legend.heavy'), 'var(--ac-cyan)']]} />}
          </div>
          <AcSeg multi value={f.sources} onChange={f.toggleSource} items={SOURCES} ariaLabel="Sources" />
        </div>
      </div>

      <WindowCard lang={lang} hours={f.tijdvakHours} avg={f.tijdvakAvg} onNextBest={f.nextBest ? f.goToNextBest : null} />

      <div className="fa-days">
        {f.data.days.map(day => (
          <DayCard key={day.date} day={day} lang={lang} selected={f.isSelected(day)} onSelect={f.selectBestMoment} />
        ))}
      </div>

      {info && <ScoreInfoDialog lang={lang} weights={f.weights} onClose={() => setInfo(false)} />}
    </div>
  )
}
