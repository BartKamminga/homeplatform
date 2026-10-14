import { useState, useEffect, useRef } from 'react'
import { api } from '@core/api.js'
import { t } from '../i18n.js'
import { AcSeg, AcSwitch, AcStepper, AcVariantSwitch } from '@components/arcade/controls.jsx'
import { up } from './tiers.js'

// Instellingen van de arcade-variant (item 1337). Zelfde ui-prefs-keys als classic InstellingenPage.
const COMPASS = [['nw', 315], ['n', 0], ['ne', 45], ['w', 270], ['none', null], ['e', 90], ['sw', 225], ['s', 180], ['se', 135]]
const PROFILES = [
  { key: 'balanced', weights: { rain: 40, temp: 24, sun: 20, wind: 16 } },
  { key: 'temp',     weights: { rain: 30, temp: 40, sun: 15, wind: 15 } },
  { key: 'wind',     weights: { rain: 30, temp: 15, sun: 15, wind: 40 } },
  { key: 'rain',     weights: { rain: 55, temp: 20, sun: 15, wind: 10 } },
]

function matchingProfile(p) {
  const cur = { rain: p.fiets_weight_rain, temp: p.fiets_weight_temp, sun: p.fiets_weight_sun, wind: p.fiets_weight_wind }
  if (Object.values(cur).every(v => v == null)) return 'balanced'
  return PROFILES.find(pr => Object.keys(pr.weights).every(k => Number(cur[k]) === pr.weights[k]))?.key ?? 'custom'
}

function LocationSearch({ lang, label, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(() => {
      setSearching(true)
      api.get(`/api/fiets/geocode?q=${encodeURIComponent(query.trim())}`)
        .then(d => setResults(d.results || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <div>
      <label className="ac-label" htmlFor="fa-loc">{t(lang, 'currentLocation')} <span style={{ color: 'var(--ac-yellow)' }}>{up(label || t(lang, 'unknown'))}</span></label>
      <input id="fa-loc" className="ac-input" value={query} onChange={e => setQuery(e.target.value)} placeholder={t(lang, 'searchPlaceholder')} />
      {searching && <p className="ac-hint" style={{ marginTop: 6 }}>{t(lang, 'searching')}</p>}
      {results.length > 0 && (
        <div className="ac-card" style={{ marginTop: 6, borderColor: 'var(--ac-cyan)' }}>
          {results.map((r, i) => (
            <button key={i} type="button" className="ac-linkrow" style={{ padding: '10px 12px' }}
              onClick={() => { onSelect(r); setQuery(''); setResults([]) }}>
              <span>{r.label}</span><em>▶</em>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SetupView({ lang, onLangChange }) {
  const [prefs, setPrefs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs').then(setPrefs).catch(e => { setError(e.message); setPrefs({}) })
  }, [])

  function save(patch) {
    setPrefs(p => ({ ...p, ...patch }))
    api.patch('/api/auth/me/ui-prefs', patch).catch(e => setError(e.message))
  }

  if (!prefs) return <div className="ac-state"><div className="ac-big-msg ac-blink">{up(t(lang, 'loadingShort'))}</div></div>

  const num = (key, def) => Number(prefs[key] ?? def)
  const windDeg = prefs.fiets_wind_pref_deg ?? null

  return (
    <div className="fa-body fa-setup">
      {error && <p className="ac-hint" style={{ color: 'var(--ac-pink)' }}>{error}</p>}

      <LocationSearch lang={lang} label={prefs.fiets_location_label}
        onSelect={r => save({ fiets_lat: r.lat, fiets_lon: r.lon, fiets_location_label: r.label })} />

      <div className="ac-card">
        <div className="ac-row"><span>INTERFACE<small>Classic is the current design, Arcade the new one.</small></span><AcVariantSwitch site="fiets" /></div>
        <div className="ac-row"><span>{up(t(lang, 'languageLabel'))}<small>{t(lang, 'languageIntro')}</small></span>
          <AcSeg value={lang} onChange={onLangChange} items={[{ value: 'nl', label: 'NL' }, { value: 'en', label: 'EN' }]} /></div>
        <div className="ac-row"><span>{up(t(lang, 'windPrefLabel'))}<small>{t(lang, 'windPrefIntro')}</small></span>
          <div className="fa-compass" role="group" aria-label={t(lang, 'windPrefLabel')}>
            {COMPASS.map(([key, deg]) => (
              <button key={key} type="button" title={t(lang, `direction.${key}`)} aria-pressed={windDeg === deg}
                className={`${windDeg === deg ? 'active' : ''}${key === 'none' ? ' mid' : ''}`}
                onClick={() => save({ fiets_wind_pref_deg: deg })}>
                {key === 'none' ? '✕' : up(key)}
              </button>
            ))}
          </div></div>
        <div className="ac-row"><span>{up(t(lang, 'profileLabel'))}<small>{t(lang, 'profileIntro')}</small></span>
          <div className="fa-profiles">
            {PROFILES.map(p => (
              <button key={p.key} type="button" className={`ac-btn ac-btn--sm${matchingProfile(prefs) === p.key ? ' on' : ''}`}
                onClick={() => save(Object.fromEntries(Object.entries(p.weights).map(([k, v]) => [`fiets_weight_${k}`, v])))}>
                {up(t(lang, `profile.${p.key}`))}
              </button>
            ))}
            {matchingProfile(prefs) === 'custom' && <span className="ac-pill tag">{up(t(lang, 'profile.custom'))}</span>}
          </div></div>
        <div className="ac-row"><span>{up(t(lang, 'rideDurationLabel'))}<small>{t(lang, 'rideDurationIntro')}</small></span>
          <AcStepper value={num('fiets_ride_duration_h', 2)} step={0.5} min={0.5} max={6} format={v => `${v} H`}
            onChange={v => save({ fiets_ride_duration_h: v })} label={t(lang, 'rideDurationLabel')} /></div>
        <div className="ac-row"><span>{up(t(lang, 'includeNightLabel'))}<small>{t(lang, 'includeNightIntro')}</small></span>
          <AcSwitch on={Boolean(prefs.fiets_include_night)} onChange={v => save({ fiets_include_night: v })} label={t(lang, 'includeNightLabel')} /></div>
      </div>

      <div>
        <span className="ac-label">COMFORT</span>
        <p className="ac-hint" style={{ marginBottom: 8 }}>{t(lang, 'comfortIntro')}</p>
        <div className="ac-card">
          <div className="ac-row"><span>{up(t(lang, 'tempMinLabel'))}</span>
            <AcStepper value={num('fiets_temp_min', 15)} min={-20} max={45} format={v => `${v}°`} onChange={v => save({ fiets_temp_min: v })} label={t(lang, 'tempMinLabel')} /></div>
          <div className="ac-row"><span>{up(t(lang, 'tempMaxLabel'))}</span>
            <AcStepper value={num('fiets_temp_max', 22)} min={-20} max={45} format={v => `${v}°`} onChange={v => save({ fiets_temp_max: v })} label={t(lang, 'tempMaxLabel')} /></div>
          <div className="ac-row"><span>{up(t(lang, 'windKneeLabel'))}</span>
            <AcStepper value={num('fiets_wind_knee_kmh', 25)} min={0} max={80} format={v => `${v} KM/H`} onChange={v => save({ fiets_wind_knee_kmh: v })} label={t(lang, 'windKneeLabel')} /></div>
        </div>
      </div>
    </div>
  )
}
