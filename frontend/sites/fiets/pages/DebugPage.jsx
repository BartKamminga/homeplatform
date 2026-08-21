import { useState, useEffect, useRef } from 'react'
import { api } from '@core/api.js'
import { t } from '../i18n.js'

const th = { padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }
const td = { padding: '4px 8px', whiteSpace: 'nowrap' }
const groupTh = { ...th, textAlign: 'center', borderLeft: '2px solid var(--color-border)' }

// Defaults matchen de vaste verdeling in services/fiets.py (RAIN_WEIGHT=0.4,
// TEMP_WIND_BUDGET=0.4 @ 60/40, SUN_WEIGHT=0.2) — als startpunt voor de inputs.
// Daglicht is geen gewicht meer (zie roadmap-item "Dag/nacht van gewogen
// score-factor naar los daglicht-filter/badge") — puur weer.
const DEFAULT_WEIGHTS = { rain: 40, temp: 24, sun: 20, wind: 16 }
const WEIGHT_KEYS = ['rain', 'temp', 'sun', 'wind']
const PREVIEW_DEBOUNCE_MS = 400

export default function DebugPage({ lang, onBeforeLeave }) {
  const [rows,    setRows]    = useState(null)
  const [error,   setError]   = useState('')
  const [weights, setWeights] = useState(null)
  const [savedState, setSavedState] = useState(null) // laatst opgeslagen waarden, voor dirty-check
  const [showExplainer, setShowExplainer] = useState(false)
  const debounceRef = useRef(null)

  function loadPreview(w) {
    const params = new URLSearchParams({
      weight_rain: w.rain, weight_temp: w.temp, weight_sun: w.sun, weight_wind: w.wind,
    })
    api.get(`/api/fiets/debug?${params}`)
      .then(d => setRows(d.rows || []))
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs').then(prefs => {
      const w = {
        rain: prefs.fiets_weight_rain ?? DEFAULT_WEIGHTS.rain,
        temp: prefs.fiets_weight_temp ?? DEFAULT_WEIGHTS.temp,
        sun:  prefs.fiets_weight_sun ?? DEFAULT_WEIGHTS.sun,
        wind: prefs.fiets_weight_wind ?? DEFAULT_WEIGHTS.wind,
      }
      setWeights(w)
      setSavedState({ weights: w })
      loadPreview(w)
    }).catch(() => {
      setWeights(DEFAULT_WEIGHTS)
      setSavedState({ weights: DEFAULT_WEIGHTS })
      loadPreview(DEFAULT_WEIGHTS)
    })
  }, [])

  // Live preview: elke wijziging herberekent (gedebounced) de tabel via de
  // querystring-preview, zonder iets op te slaan (geen Toepassen-knop meer).
  useEffect(() => {
    if (!weights) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadPreview(weights), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [weights])

  function isDirty() {
    if (!savedState || !weights) return false
    return WEIGHT_KEYS.some(key => Number(weights[key]) !== Number(savedState.weights[key]))
  }

  async function saveNow() {
    await api.patch('/api/auth/me/ui-prefs', {
      fiets_weight_rain: Number(weights.rain), fiets_weight_temp: Number(weights.temp),
      fiets_weight_sun: Number(weights.sun), fiets_weight_wind: Number(weights.wind),
    })
    setSavedState({ weights })
  }

  // Aangeroepen door FietsLayout vlak vóórdat de gebruiker deze pagina verlaat.
  useEffect(() => {
    if (!onBeforeLeave) return
    onBeforeLeave.current = () => {
      if (isDirty() && window.confirm(t(lang, 'confirmLeave'))) {
        saveNow().catch(() => {})
      }
    }
    return () => { if (onBeforeLeave) onBeforeLeave.current = null }
  }, [weights, savedState])

  function updateWeight(key, value) {
    setWeights(w => ({ ...w, [key]: value }))
  }

  if (!weights) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>{t(lang, 'loadingShort')}</div>
  if (error) return <p style={{ padding: 20, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>

  const total = WEIGHT_KEYS.reduce((sum, key) => sum + Number(weights[key] || 0), 0) || 1

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
          {t(lang, 'debugIntro')}
        </p>
        <button
          onClick={() => setShowExplainer(v => !v)}
          aria-label={t(lang, 'howScoreWorks')}
          style={{
            fontSize: 15, width: 26, height: 26, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
            border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)',
          }}
        >
          ⓘ
        </button>
      </div>

      {showExplainer && (
        <div style={{
          padding: '12px 14px', marginBottom: 14, fontSize: 12, lineHeight: 1.6, color: 'var(--color-text)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10,
        }}>
          {weightRows(lang, weights).map(({ key, icon, label, pct, note }) => (
            <p key={key} style={{ margin: '0 0 6px' }}>{icon} <strong>{label}</strong> — {t(lang, 'weightPct', { pct })} {note}</p>
          ))}
          <p style={{ margin: 0 }}>🌙 <strong>{t(lang, 'daylightTitle')}</strong> — {t(lang, 'daylightDebugExplain')}</p>
        </div>
      )}

      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14,
        padding: '12px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10,
      }}>
        {WEIGHT_KEYS.map(key => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t(lang, `weight.${key}`)}</label>
            <input
              type="number" min={0} max={100} value={weights[key]}
              onChange={e => updateWeight(key, e.target.value)}
              style={{
                width: 56, fontSize: 12, padding: '4px 6px', borderRadius: 6,
                border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)',
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
              {Math.round(Number(weights[key] || 0) / total * 100)}%
            </span>
          </div>
        ))}

        {isDirty() && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', paddingBottom: 4 }}>
            {t(lang, 'notSaved')}
          </span>
        )}
      </div>

      <LabelThresholds lang={lang} />

      <div style={{ overflowX: 'auto', overflowY: 'hidden', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
          <thead>
            <tr>
              <th style={th}>{t(lang, 'col.time')}</th>
              <th style={th}>{t(lang, 'col.day')}</th>
              <th style={groupTh} colSpan={5}>KNMI</th>
              <th style={groupTh} colSpan={5}>GFS</th>
              <th style={groupTh} colSpan={5}>ICON</th>
              <th style={groupTh} colSpan={5}>{t(lang, 'col.blended')}</th>
              <th style={groupTh} title={t(lang, 'col.deviationTitle')}>{t(lang, 'col.deviation')}</th>
              <th style={groupTh} colSpan={7}>{t(lang, 'col.score')}</th>
            </tr>
            <tr>
              <th style={th}></th>
              <th style={th}></th>
              {['temp','mm','code','cloud','wind'].map(h => <th key={`k-${h}`} style={th}>{h === 'cloud' ? t(lang, 'sub.cloud') : h}</th>)}
              {['temp','mm','code','cloud','wind'].map(h => <th key={`g-${h}`} style={th}>{h === 'cloud' ? t(lang, 'sub.cloud') : h}</th>)}
              {['temp','mm','code','cloud','wind'].map(h => <th key={`i-${h}`} style={th}>{h === 'cloud' ? t(lang, 'sub.cloud') : h}</th>)}
              {['temp','mm','tier','cloud','wind'].map(h => (
                <th key={`b-${h}`} style={th}>
                  {h === 'cloud' ? t(lang, 'sub.cloud') : h}
                  {h === 'tier' && (
                    <span
                      title={t(lang, 'tierColTooltip')}
                      style={{ marginLeft: 3, cursor: 'help', fontWeight: 400 }}
                    >
                      ⓘ
                    </span>
                  )}
                </th>
              ))}
              <th style={th}></th>
              {['rain','temp','sun','wind','weather','total'].map(h => (
                <th key={`s-${h}`} style={th}>
                  {t(lang, `sub.${h}`)}
                  {h === 'weather' && (
                    <span
                      title={t(lang, 'weatherColTooltip')}
                      style={{ marginLeft: 3, cursor: 'help', fontWeight: 400 }}
                    >
                      ⓘ
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r, i) => (
              <tr key={i}>
                <td style={td}>{r.time.slice(5).replace('T', ' ')}</td>
                <td style={td} title={t(lang, 'daylightFactorTooltip')}>
                  {{ dag: '☀️', schemer: '🌆', nacht: '🌙' }[r.daylight_state]} {r.daylight_factor}
                </td>
                <td style={td}>{r.sources.knmi.temp}°</td>
                <td style={td}>{r.sources.knmi.rain_mm}</td>
                <td style={td}>{r.sources.knmi.weather_code}</td>
                <td style={td}>{r.sources.knmi.cloud_cover}</td>
                <td style={td}>{Math.round(r.sources.knmi.wind_kmh)}</td>
                <td style={td}>{r.sources.gfs.temp}°</td>
                <td style={td}>{r.sources.gfs.rain_mm}</td>
                <td style={td}>{r.sources.gfs.weather_code}</td>
                <td style={td}>{r.sources.gfs.cloud_cover}</td>
                <td style={td}>{Math.round(r.sources.gfs.wind_kmh)}</td>
                <td style={td}>{r.sources.icon.temp}°</td>
                <td style={td}>{r.sources.icon.rain_mm}</td>
                <td style={td}>{r.sources.icon.weather_code}</td>
                <td style={td}>{r.sources.icon.cloud_cover}</td>
                <td style={td}>{Math.round(r.sources.icon.wind_kmh)}</td>
                <td style={td}>{r.blended.temp}°</td>
                <td style={td}>{r.blended.rain_mm}</td>
                <td style={td}>{r.blended.rain_tier}</td>
                <td style={td}>{r.blended.cloud_cover}</td>
                <td style={td}>{Math.round(r.blended.wind_kmh)}</td>
                <td style={td}>{r.low_confidence ? '⚠️' : ''}</td>
                <td style={td}>{r.score.rain_contrib}</td>
                <td style={td}>{r.score.temp_contrib}</td>
                <td style={td}>{r.score.sun_contrib}</td>
                <td style={td}>{r.score.wind_contrib}</td>
                <td style={{ ...td, color: 'var(--color-text-muted)' }}>{r.score.weather_score}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.score.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Zet de actuele (live, nog niet per se opgeslagen) gewichten om naar
// percentages voor de (i)-uitleg-kaart — leest rechtstreeks de lokale
// weights-state van deze pagina, dus wijzigt meteen mee met de inputs erboven.
function weightRows(lang, weights) {
  const total = WEIGHT_KEYS.reduce((sum, key) => sum + Number(weights[key] || 0), 0) || 1
  const icons = { rain: '🌧', temp: '🌡', sun: '☀️', wind: '💨' }
  const noteKey = { rain: 'weightNote.rain', temp: 'debugWeightNote.temp', sun: 'weightNote.sun', wind: 'debugWeightNote.wind' }
  return WEIGHT_KEYS
    .map(key => ({
      key, icon: icons[key], label: t(lang, `weight.${key}`), note: t(lang, noteKey[key]),
      pct: Math.round(Number(weights[key] || 0) / total * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
}

// Score-staffel voor de beste-moment-labels — een nerd-instelling, los van de
// live weight-preview hierboven (verandert niets aan de per-uur debug-rijen,
// alleen aan het "Beste moment"-label dat de hoofd-app toont).
const LABEL_FIELDS = [
  { key: 'excellent', prefKey: 'fiets_label_excellent', defaultValue: 8 },
  { key: 'good',      prefKey: 'fiets_label_good',      defaultValue: 6 },
  { key: 'fair',      prefKey: 'fiets_label_fair',      defaultValue: 4 },
]

function LabelThresholds({ lang }) {
  const [values, setValues] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs').then(prefs => {
      setValues(Object.fromEntries(LABEL_FIELDS.map(f => [f.key, prefs[f.prefKey] ?? f.defaultValue])))
    }).catch(() => {
      setValues(Object.fromEntries(LABEL_FIELDS.map(f => [f.key, f.defaultValue])))
    })
  }, [])

  async function save(key, value) {
    setValues(v => ({ ...v, [key]: value }))
    const field = LABEL_FIELDS.find(f => f.key === key)
    setSaving(true)
    try {
      await api.patch('/api/auth/me/ui-prefs', { [field.prefKey]: Number(value) })
    } catch { /* stil falen, dit is een nerd-instelling zonder groot risico */ }
    finally { setSaving(false) }
  }

  if (!values) return null

  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14,
      padding: '12px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10,
    }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: '100%' }}>
        {t(lang, 'labelThresholdsTitle')}
      </span>
      {LABEL_FIELDS.map(f => (
        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t(lang, `labelThreshold.${f.key}`)}</label>
          <input
            type="number" min={0} max={10} step={0.5} value={values[f.key]} disabled={saving}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            onBlur={e => save(f.key, e.target.value)}
            style={{
              width: 56, fontSize: 12, padding: '4px 6px', borderRadius: 6,
              border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)',
            }}
          />
        </div>
      ))}
    </div>
  )
}
