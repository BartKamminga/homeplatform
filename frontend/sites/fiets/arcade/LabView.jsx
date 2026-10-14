import { useState, useEffect, useRef } from 'react'
import { api } from '@core/api.js'
import { t } from '../i18n.js'
import LabTable from './LabTable.jsx'
import { ScoreInfoDialog } from './ForecastCards.jsx'
import { FACTOR_COLOR, TIER_COLOR, up } from './tiers.js'

// Lab (debug) van de arcade-variant (item 1337): gewichten met live preview, staffel en uurtabel.
const DEFAULT_WEIGHTS = { rain: 40, temp: 24, sun: 20, wind: 16 }
const KEYS = ['rain', 'temp', 'sun', 'wind']
const LABELS = [
  { key: 'excellent', pref: 'fiets_label_excellent', def: 8 },
  { key: 'good', pref: 'fiets_label_good', def: 6 },
  { key: 'fair', pref: 'fiets_label_fair', def: 4 },
]

function Thresholds({ lang, values, onChange, onSave }) {
  const ex = Number(values.excellent), gd = Number(values.good), fr = Number(values.fair)
  const seg = [['poor', fr], ['fair', gd - fr], ['good', ex - gd], ['excellent', 10 - ex]]
  return (
    <div className="ac-card fa-thr">
      <span className="ac-label">{t(lang, 'labelThresholdsTitle')}</span>
      <div className="fa-thr-bar">
        {seg.map(([k, w]) => <div key={k} style={{ flex: Math.max(0.3, w), background: TIER_COLOR[k] }}>{up(t(lang, `tier.${k}`))}</div>)}
      </div>
      <div className="fa-thr-inputs">
        {LABELS.map(f => (
          <label key={f.key}>
            <span className="ac-label">{t(lang, `labelThreshold.${f.key}`)}</span>
            <input className="ac-input" type="number" min={0} max={10} step={0.5} value={values[f.key]}
              onChange={e => onChange(f.key, e.target.value)} onBlur={e => onSave(f, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}

export default function LabView({ lang, guardRef }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [weights, setWeights] = useState(null)
  const [saved, setSaved] = useState(null)
  const [labels, setLabels] = useState(null)
  const [info, setInfo] = useState(false)
  const debounce = useRef(null)

  function loadPreview(w) {
    const params = new URLSearchParams({ weight_rain: w.rain, weight_temp: w.temp, weight_sun: w.sun, weight_wind: w.wind })
    api.get(`/api/fiets/debug?${params}`).then(d => setRows(d.rows || [])).catch(e => setError(e.message))
  }

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs').catch(() => ({})).then(prefs => {
      const w = Object.fromEntries(KEYS.map(k => [k, prefs[`fiets_weight_${k}`] ?? DEFAULT_WEIGHTS[k]]))
      setWeights(w); setSaved(w); loadPreview(w)
      setLabels(Object.fromEntries(LABELS.map(f => [f.key, prefs[f.pref] ?? f.def])))
    })
  }, [])

  useEffect(() => {
    if (!weights) return
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => loadPreview(weights), 400)
    return () => clearTimeout(debounce.current)
  }, [weights])

  const dirty = Boolean(weights && saved && KEYS.some(k => Number(weights[k]) !== Number(saved[k])))

  async function saveWeights() {
    await api.patch('/api/auth/me/ui-prefs', Object.fromEntries(KEYS.map(k => [`fiets_weight_${k}`, Number(weights[k])])))
    setSaved(weights)
  }

  // ArcadeApp vraagt bij het verlaten of er onopgeslagen gewichten zijn.
  useEffect(() => {
    if (!guardRef) return
    guardRef.current = { dirty, save: () => saveWeights().catch(() => {}) }
    return () => { guardRef.current = null }
  })

  function saveLabel(field, value) {
    api.patch('/api/auth/me/ui-prefs', { [field.pref]: Number(value) }).catch(() => {})
  }

  if (!weights) return <div className="ac-state"><div className="ac-big-msg ac-blink">{up(t(lang, 'loadingShort'))}</div></div>
  const total = KEYS.reduce((s, k) => s + Number(weights[k] || 0), 0) || 1

  return (
    <div className="fa-body">
      <div className="fa-lab-intro">
        <p className="ac-hint">{t(lang, 'debugIntro')}</p>
        <button type="button" className="ac-icon" aria-label={t(lang, 'howScoreWorks')} onClick={() => setInfo(true)}>i</button>
      </div>
      {error && <p className="ac-hint" style={{ color: 'var(--ac-pink)' }}>{error}</p>}

      <div className="fa-weights">
        {KEYS.map(k => (
          <label key={k} className="ac-card">
            <span className="ac-label" style={{ color: FACTOR_COLOR[k] }}>{t(lang, `weight.${k}`)}</span>
            <input className="ac-input" type="number" min={0} max={100} value={weights[k]}
              onChange={e => setWeights(w => ({ ...w, [k]: e.target.value }))} />
            <span className="fa-pct">{Math.round(Number(weights[k] || 0) / total * 100)}%</span>
          </label>
        ))}
      </div>
      <div className="fa-lab-actions">
        {dirty && <span className="ac-pill queued">{up(t(lang, 'notSaved'))}</span>}
        <button type="button" className="ac-btn" disabled={!dirty} onClick={() => setWeights(saved)}>RESET</button>
        <button type="button" className="ac-btn ac-btn--primary" disabled={!dirty} onClick={() => saveWeights().catch(e => setError(e.message))}>SAVE</button>
      </div>

      {labels && <Thresholds lang={lang} values={labels} onChange={(k, v) => setLabels(l => ({ ...l, [k]: v }))} onSave={saveLabel} />}

      {rows ? <LabTable lang={lang} rows={rows} /> : <p className="ac-hint">{t(lang, 'loadingShort')}</p>}

      {info && <ScoreInfoDialog lang={lang} weights={weights} debug onClose={() => setInfo(false)} />}
    </div>
  )
}
