import { t } from '../i18n.js'
import { tierColor, up } from './tiers.js'

// Uurtabel van het Lab (arcade, item 1337): bronnen, blended en score-opbouw per uur.
const SRC_COLS = ['temp', 'mm', 'code', 'cloud', 'wind']
const DAYLIGHT = { dag: '☀', schemer: '◐', nacht: '☾' }

function srcCells(s) {
  return [`${s.temp}°`, s.rain_mm, s.weather_code, s.cloud_cover, Math.round(s.wind_kmh)]
}

export default function LabTable({ lang, rows }) {
  const sub = h => (h === 'cloud' ? t(lang, 'sub.cloud') : h)
  return (
    <div className="ac-card fa-table-wrap">
      <table className="fa-table">
        <thead>
          <tr>
            <th /><th />
            {['KNMI', 'GFS', 'ICON', up(t(lang, 'col.blended'))].map(g => <th key={g} className="g" colSpan={5}>{g}</th>)}
            <th className="g" title={t(lang, 'col.deviationTitle')}>{up(t(lang, 'col.deviation'))}</th>
            <th className="g" colSpan={6}>{up(t(lang, 'col.score'))}</th>
          </tr>
          <tr>
            <th>{up(t(lang, 'col.time'))}</th>
            <th title={t(lang, 'daylightFactorTooltip')}>{up(t(lang, 'col.day'))}</th>
            {['k', 'g', 'i'].flatMap(p => SRC_COLS.map(h => <th key={p + h}>{up(sub(h))}</th>))}
            {['temp', 'mm', 'tier', 'cloud', 'wind'].map(h => (
              <th key={`b${h}`} title={h === 'tier' ? t(lang, 'tierColTooltip') : undefined}>{up(sub(h))}</th>
            ))}
            <th />
            {['rain', 'temp', 'sun', 'wind', 'weather', 'total'].map(h => (
              <th key={`s${h}`} title={h === 'weather' ? t(lang, 'weatherColTooltip') : undefined}>{up(t(lang, `sub.${h}`))}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.daylight_state === 'nacht' ? 'dark' : ''}>
              <td>{r.time.slice(5).replace('T', ' ')}</td>
              <td>{DAYLIGHT[r.daylight_state]} {r.daylight_factor}</td>
              {['knmi', 'gfs', 'icon'].flatMap(src => srcCells(r.sources[src]).map((v, j) => <td key={src + j}>{v}</td>))}
              <td>{r.blended.temp}°</td><td>{r.blended.rain_mm}</td><td>{r.blended.rain_tier}</td>
              <td>{r.blended.cloud_cover}</td><td>{Math.round(r.blended.wind_kmh)}</td>
              <td className="warn">{r.low_confidence ? '⚠' : ''}</td>
              <td>{r.score.rain_contrib}</td><td>{r.score.temp_contrib}</td><td>{r.score.sun_contrib}</td><td>{r.score.wind_contrib}</td>
              <td className="muted">{r.score.weather_score}</td>
              <td className="tot" style={{ color: tierColor(r.score.score) }}>{r.score.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
