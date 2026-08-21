import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import SmoothChart, { BREAKDOWN_COLORS, RAIN_TIER_OPACITY } from '../components/SmoothChart.jsx'
import DayCard from '../components/DayCard.jsx'
import { scoreColor, scoreLabel } from '../scoreUtils.js'

const TABS = [
  { key: 'fiets', label: 'Fiets',        field: 'score' },
  { key: 'temp',  label: 'Temp',         field: 'temp' },
  { key: 'rain',  label: 'Regen',        field: 'rain_mm' },
  { key: 'wind',  label: 'Wind',         field: 'wind_kmh' },
  { key: 'zon',   label: 'Zon',          field: 'sun_pct' },
]

const SOURCES = [
  { key: 'knmi', label: 'KNMI' },
  { key: 'gfs',  label: 'GFS' },
  { key: 'icon', label: 'ICON' },
]

const WIND_MODES = [
  { key: 'chart', label: 'Grafiek' },
  { key: 'arrow', label: 'Pijl' },
  { key: 'both',  label: 'Beide' },
]

// Tijden uit de API zijn lokaal, zonder 'Z' — Date parseert die als lokale
// tijd, dus met de Date-methoden (niet toISOString, die naar UTC zou draaien)
// erbij/eraf rekenen blijft consistent.
function isoPlusHours(iso, n) {
  const d = new Date(iso)
  d.setHours(d.getHours() + n)
  const pad = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Startindex voor het tijdvak: begin bij "nu" zodat je niet eerst terug in de
// tijd moet schuiven naar een relevant moment.
function nowStartIndex(hours, len) {
  const now = Date.now()
  let idx = hours.findIndex(h => new Date(h.time).getTime() >= now)
  if (idx === -1) idx = 0
  return Math.max(0, Math.min(idx, hours.length - len))
}

export default function PrognosePage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState('fiets')
  const [sources, setSources] = useState(['knmi', 'gfs', 'icon'])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showExplainer, setShowExplainer] = useState(false)
  const [windMode, setWindMode] = useState('arrow')
  // Tijdvak: altijd actief (geen aan/uit-toggle meer, item 862), start/eind als
  // uur-index in de platte 72-uurs reeks. null tot de data + rittijd-instelling
  // geladen zijn, dan één keer geïnitialiseerd op "nu".
  const [tijdvak, setTijdvak] = useState(null)
  const [rideDurationH, setRideDurationH] = useState(2)
  const [dayFilter, setDayFilter] = useState(null) // null = alle dagen, anders day.date — item 866 (inzoomen op mobiel)
  // Defaults matchen services/fiets.py (RAIN_WEIGHT=0.4, TEMP_WIND_BUDGET=0.4
  // @ 60/40, SUN_WEIGHT=0.2) — voor de uitleg-popup, die zo altijd de actuele
  // verdeling toont i.p.v. hardcoded percentages.
  const [weights, setWeights] = useState({ rain: 40, temp: 24, sun: 20, wind: 16 })

  useEffect(() => {
    setLoading(true)
    api.get(`/api/fiets/prognose?sources=${sources.join(',')}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sources])

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs')
      .then(prefs => {
        setShowBreakdown(Boolean(prefs.fiets_show_breakdown))
        setWeights(w => ({
          rain: prefs.fiets_weight_rain ?? w.rain,
          temp: prefs.fiets_weight_temp ?? w.temp,
          sun: prefs.fiets_weight_sun ?? w.sun,
          wind: prefs.fiets_weight_wind ?? w.wind,
        }))
        if (prefs.fiets_ride_duration_h) setRideDurationH(prefs.fiets_ride_duration_h)
      })
      .catch(() => {})
  }, [])

  // Tijdvak eenmalig initialiseren zodra de data binnen is — start bij "nu",
  // lengte op de ingestelde gemiddelde rittijd.
  useEffect(() => {
    if (!data || tijdvak) return
    const allHours = data.days.flatMap(d => d.hours)
    if (allHours.length === 0) return
    const len = Math.max(1, Math.min(allHours.length, Math.round(rideDurationH)))
    const startIdx = nowStartIndex(allHours, len)
    setTijdvak({ startIdx, endIdx: startIdx + len - 1 })
  }, [data])

  function toggleBreakdown() {
    setShowBreakdown(v => {
      const next = !v
      api.patch('/api/auth/me/ui-prefs', { fiets_show_breakdown: next }).catch(() => {})
      return next
    })
  }

  // "Beste moment" aanklikken (item 831) verplaatst hetzelfde tijdvak naar dat
  // venster — één samenhangend concept i.p.v. een los "geselecteerd"-mechanisme.
  // Zoomt ook meteen in op die dag (item 866), anders is de band onzichtbaar
  // als je op een andere dag ingezoomd stond.
  function selectBestMoment(allHours, day, w) {
    const startIdx = allHours.findIndex(h => h.time === w.start)
    if (startIdx === -1) return
    const spanHours = Math.max(1, Math.round((new Date(w.end) - new Date(w.start)) / 3600000))
    setTijdvak({ startIdx, endIdx: Math.min(allHours.length - 1, startIdx + spanHours - 1) })
    setDayFilter(day.date)
  }

  // Slepen aan een handvat op de grafiek (item 862) — start/eind blijven altijd
  // in de juiste volgorde (min. 1 uur venster).
  function handleTijdvakDrag(edge, idx) {
    setTijdvak(prev => {
      if (!prev) return prev
      if (edge === 'start') return { startIdx: Math.min(idx, prev.endIdx), endIdx: prev.endIdx }
      return { startIdx: prev.startIdx, endIdx: Math.max(idx, prev.startIdx) }
    })
  }

  function toggleSource(key) {
    setSources(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(s => s !== key)
        return next.length > 0 ? next : prev // minstens 1 bron actief houden
      }
      return [...prev, key]
    })
  }

  if (loading) return (
    <div style={center}>
      <span style={{ fontSize: 40 }}>🚴</span>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Prognose laden…</p>
    </div>
  )

  if (error || data?.status === 'error') return (
    <div style={center}>
      <span style={{ fontSize: 40 }}>⚠️</span>
      <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 12 }}>{error || data?.message}</p>
    </div>
  )

  if (!data || data.days.length === 0) return (
    <div style={center}>
      <span style={{ fontSize: 56 }}>🚴</span>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginTop: 16, maxWidth: 260, lineHeight: 1.5, textAlign: 'center' }}>
        De fietsweersvoorspelling is nog in ontwikkeling.
        <br /><br />
        Binnenkort zie je hier wanneer het beste moment is om te gaan fietsen.
      </p>
    </div>
  )

  const activeField = TABS.find(t => t.key === tab).field
  const allHours = data.days.flatMap(d => d.hours)
  const tijdvakHours = tijdvak ? allHours.slice(tijdvak.startIdx, tijdvak.endIdx + 1) : []
  const tijdvakAvg = tijdvakHours.length
    ? Math.round(tijdvakHours.reduce((sum, h) => sum + h.score, 0) / tijdvakHours.length * 10) / 10
    : null

  // Inzoomen op 1 dag (item 866) — op een klein scherm is 72 uur in 1 grafiek
  // te krap om het tijdvak precies te verslepen. hourOffset vertaalt de
  // globale tijdvak-indices naar lokale indices binnen de ingezoomde dag.
  const displayedDays = dayFilter ? data.days.filter(d => d.date === dayFilter) : data.days
  const hourOffset = dayFilter ? allHours.findIndex(h => h.time === displayedDays[0]?.hours[0]?.time) : 0

  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {data.location?.label && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>📍 {data.location.label}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSource(s.key)}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${sources.includes(s.key) ? 'var(--color-text-muted)' : 'var(--color-border)'}`,
                background: sources.includes(s.key) ? 'var(--color-surface)' : 'transparent',
                color: sources.includes(s.key) ? 'var(--color-text)' : 'var(--color-text-muted)',
                opacity: sources.includes(s.key) ? 1 : 0.6,
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setShowExplainer(v => !v)}
            aria-label="Hoe werkt de score?"
            style={{
              fontSize: 15, width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
              border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)',
            }}
          >
            ⓘ
          </button>
        </div>
      </div>
      {showExplainer && (
        <div
          onClick={() => setShowExplainer(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14,
              padding: '18px 18px 16px', maxWidth: 340, width: '100%', maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hoe werkt de score?</h3>
              <button
                onClick={() => setShowExplainer(false)}
                aria-label="Sluiten"
                style={{ fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--color-text)' }}>
              {weightRows(weights).map(({ key, icon, label, pct, note }) => (
                <p key={key} style={{ margin: '0 0 6px' }}>{icon} <strong>{label}</strong> — telt voor {pct}% mee. {note}</p>
              ))}
              <p style={{ margin: '0 0 6px' }}>🌙 <strong>Daglicht</strong> — werkt los van de 4 gewichten hierboven: 's nachts dimt de score vloeiend naar 0, overdag blijft hij onveranderd. Instelbaar via "neem ook donkere uren mee" bij Instellingen.</p>
              <p style={{ margin: 0 }}>📡 <strong>3 bronnen</strong> — de score is een gemiddelde van KNMI, NOAA GFS en DWD ICON. Zijn ze het duidelijk niet eens? Dan zie je een grijze stip.</p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, whiteSpace: 'nowrap',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: '16px 12px 10px', marginBottom: 16,
      }}>
        <SmoothChart
          days={displayedDays} field={activeField} showBreakdown={tab === 'fiets' && showBreakdown} windMode={windMode}
          tijdvak={tijdvak} onTijdvakDrag={handleTijdvakDrag} hourOffset={hourOffset}
        />

        {/* Info-balk onder de grafiek — per tab relevante info, altijd zichtbaar
            (item 806) i.p.v. alleen bij Fiets/Wind en leeg bij de rest. minHeight
            vast houden: anders verspringt de kaart (en alles daaronder) bij het
            wisselen van tab, omdat Fiets/Wind meer items bevatten dan Temp/Zon
            en dus eerder naar 2 regels wrappen. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap', minHeight: 40 }}>
          {tab === 'wind' && WIND_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setWindMode(m.key)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${windMode === m.key ? 'var(--color-text-muted)' : 'var(--color-border)'}`,
                background: windMode === m.key ? 'var(--color-background)' : 'transparent',
                color: windMode === m.key ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}
            >
              {m.label}
            </button>
          ))}

          {tab === 'fiets' && (
            <>
              <button
                onClick={toggleBreakdown}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)',
                }}
              >
                {showBreakdown ? 'Met opbouw' : 'Simpel'}
              </button>
              {showBreakdown ? (
                <>
                  <Legend color={BREAKDOWN_COLORS.rain} label="Regen" />
                  <Legend color={BREAKDOWN_COLORS.temp} label="Temperatuur" />
                  <Legend color={BREAKDOWN_COLORS.sun} label="Zon" />
                  <Legend color={BREAKDOWN_COLORS.wind} label="Wind" />
                </>
              ) : (
                <Legend color={BREAKDOWN_COLORS.fiets} label="Score" />
              )}
            </>
          )}

          {tab === 'rain' && (
            <>
              <Legend color={BREAKDOWN_COLORS.rain} opacity={RAIN_TIER_OPACITY[1]} label="Licht" />
              <Legend color={BREAKDOWN_COLORS.rain} opacity={RAIN_TIER_OPACITY[2]} label="Matig" />
              <Legend color={BREAKDOWN_COLORS.rain} opacity={RAIN_TIER_OPACITY[3]} label="Zwaar" />
            </>
          )}

          <span>· grijze stip = bronnen zijn het niet eens</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setDayFilter(null)}
          style={dayChipStyle(dayFilter === null)}
        >
          Alle dagen
        </button>
        {data.days.map(d => (
          <button
            key={d.date}
            onClick={() => setDayFilter(d.date)}
            style={dayChipStyle(dayFilter === d.date)}
          >
            {new Date(d.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tijdvakHours.length > 0 && (
          <TijdvakCard
            startTime={tijdvakHours[0].time}
            endTime={isoPlusHours(tijdvakHours[tijdvakHours.length - 1].time, 1)}
            avg={tijdvakAvg}
          />
        )}
        {data.days.map(day => (
          <DayCard
            key={day.date} day={day}
            selected={Boolean(tijdvak && day.best_window && tijdvak.startIdx === allHours.findIndex(h => h.time === day.best_window.start))}
            onSelectBestMoment={(day, w) => selectBestMoment(allHours, day, w)}
          />
        ))}
      </div>
    </div>
  )
}

// Altijd-zichtbare kaart voor het zelf te verkennen tijdvak (item 862) —
// zelfde stijl als DayCard's "beste moment", maar dan voor het venster dat je
// met de handvatjes op de grafiek hebt versleept.
function TijdvakCard({ startTime, endTime, avg }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '10px 14px',
      borderLeft: `4px solid ${avg != null ? scoreColor(avg) : 'var(--color-border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>🕐 Tijdvak</div>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>sleep de handvatjes op de grafiek</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
        {startTime.slice(11, 16)}–{endTime.slice(11, 16)} · <strong style={{ color: 'var(--color-text)' }}>{avg}</strong> {scoreLabel(avg)}
      </div>
    </div>
  )
}

// Zet de actuele (eventueel door de gebruiker aangepaste) gewichten om naar
// percentages voor de uitleg-popup, altijd op basis van de live waarden i.p.v.
// hardcoded tekst — zo blijft de uitleg kloppen als de formule/instellingen wijzigen.
function weightRows(weights) {
  const total = Object.values(weights).reduce((sum, v) => sum + Number(v || 0), 0) || 1
  const notes = {
    rain: 'Hoe meer het regent en hoe zwaarder de bui, hoe lager deze bijdrage.',
    temp: 'Prettigst tussen 15-22°C, instelbaar.',
    sun: 'Meer zon (minder bewolking) is beter.',
    wind: 'Harde wind en tegenwind tellen negatief, instelbaar.',
  }
  const icons = { rain: '🌧', temp: '🌡', sun: '☀️', wind: '💨' }
  const labels = { rain: 'Regen', temp: 'Temperatuur', sun: 'Zon', wind: 'Wind' }
  return Object.keys(weights)
    .map(key => ({ key, icon: icons[key], label: labels[key], note: notes[key], pct: Math.round(Number(weights[key] || 0) / total * 100) }))
    .sort((a, b) => b.pct - a.pct)
}

function Legend({ color, label, opacity = 1 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, opacity, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// Dag-chips om in te zoomen op 1 dag (item 866) — zelfde pil-stijl als de
// bron-toggles, actief = primary-kleur zoals de tabs.
function dayChipStyle(active) {
  return {
    fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-surface)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  }
}

const center = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
}
