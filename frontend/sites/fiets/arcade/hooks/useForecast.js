import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Data en tijdvak-logica van de Prognose-pagina, voor de arcade-variant (item 1337).
// Bewust een kopie van classic PrognosePage (die blijft ongewijzigd); na de keuze verdwijnt er één.

const DEFAULT_WEIGHTS = { rain: 40, temp: 24, sun: 20, wind: 16 }

// API-tijden zijn lokaal zonder 'Z' — met Date-methoden rekenen blijft consistent.
export function isoPlusHours(iso, n) {
  const d = new Date(iso)
  d.setHours(d.getHours() + n)
  const pad = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function nowStartIndex(hours, len) {
  const now = Date.now()
  let idx = hours.findIndex(h => new Date(h.time).getTime() >= now)
  if (idx === -1) idx = 0
  return Math.max(0, Math.min(idx, hours.length - len))
}

function nextBestWindowToday(dayHours, len) {
  const now = Date.now()
  const fromIdx = dayHours.findIndex(h => new Date(h.time).getTime() >= now)
  if (fromIdx === -1) return null
  let best = null
  for (let start = fromIdx; start <= dayHours.length - len; start++) {
    const win = dayHours.slice(start, start + len)
    const avg = win.reduce((sum, h) => sum + h.score, 0) / win.length
    if (!best || avg > best.avg) best = { startIdx: start, avg }
  }
  return best
}

export function useForecast() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sources, setSources] = useState(['knmi', 'gfs', 'icon'])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [rideDurationH, setRideDurationH] = useState(2)
  const [aiScores, setAiScores] = useState(null)
  const [tijdvak, setTijdvak] = useState(null)
  const [dayFilter, setDayFilter] = useState(null)

  // Elke 15 min stil verversen (zelfde als classic, item 949).
  useEffect(() => {
    function load(silent) {
      if (!silent) setLoading(true)
      api.get(`/api/fiets/prognose?sources=${sources.join(',')}`)
        .then(d => { setData(d); setError('') })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
    load(false)
    const interval = setInterval(() => load(true), 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sources])

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs')
      .then(prefs => {
        setShowBreakdown(Boolean(prefs.fiets_show_breakdown))
        setWeights(w => ({
          rain: prefs.fiets_weight_rain ?? w.rain, temp: prefs.fiets_weight_temp ?? w.temp,
          sun: prefs.fiets_weight_sun ?? w.sun, wind: prefs.fiets_weight_wind ?? w.wind,
        }))
        if (prefs.fiets_ride_duration_h) setRideDurationH(prefs.fiets_ride_duration_h)
        if (Array.isArray(prefs.fiets_ai_score)) setAiScores(prefs.fiets_ai_score)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!data || tijdvak) return
    const allHours = data.days.flatMap(d => d.hours)
    if (allHours.length === 0) return
    const len = Math.max(1, Math.min(allHours.length, Math.round(rideDurationH)))
    const startIdx = nowStartIndex(allHours, len)
    setTijdvak({ startIdx, endIdx: startIdx + len - 1 })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  function setBreakdown(next) {
    setShowBreakdown(next)
    api.patch('/api/auth/me/ui-prefs', { fiets_show_breakdown: next }).catch(() => {})
  }

  function toggleSource(key) {
    setSources(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(s => s !== key)
        return next.length > 0 ? next : prev
      }
      return [...prev, key]
    })
  }

  function dragTijdvak(edge, idx) {
    setTijdvak(prev => {
      if (!prev) return prev
      if (edge === 'start') return { startIdx: Math.min(idx, prev.endIdx), endIdx: prev.endIdx }
      return { startIdx: prev.startIdx, endIdx: Math.max(idx, prev.startIdx) }
    })
  }

  const days = data?.days ?? []
  const allHours = days.flatMap(d => d.hours)
  const tijdvakHours = tijdvak ? allHours.slice(tijdvak.startIdx, tijdvak.endIdx + 1) : []
  const tijdvakAvg = tijdvakHours.length
    ? Math.round(tijdvakHours.reduce((sum, h) => sum + h.score, 0) / tijdvakHours.length * 10) / 10
    : null
  const tijdvakLen = tijdvak ? tijdvak.endIdx - tijdvak.startIdx + 1 : Math.max(1, Math.round(rideDurationH))
  const today = days[0]
  const nextBest = today ? nextBestWindowToday(today.hours, tijdvakLen) : null

  function goToNextBest() {
    if (!nextBest) return
    const globalStart = allHours.findIndex(h => h.time === today.hours[0].time) + nextBest.startIdx
    setTijdvak({ startIdx: globalStart, endIdx: globalStart + tijdvakLen - 1 })
    setDayFilter(today.date)
  }

  // Beste moment van een dag aanklikken: tijdvak erheen en inzoomen; nogmaals = uitzoomen.
  function selectBestMoment(day) {
    const w = day.best_window
    if (!w) return
    const startIdx = allHours.findIndex(h => h.time === w.start)
    if (startIdx === -1) return
    if (dayFilter === day.date && tijdvak && tijdvak.startIdx === startIdx) { setDayFilter(null); return }
    const span = Math.max(1, Math.round((new Date(w.end) - new Date(w.start)) / 3600000))
    setTijdvak({ startIdx, endIdx: Math.min(allHours.length - 1, startIdx + span - 1) })
    setDayFilter(day.date)
  }

  const displayedDays = dayFilter ? days.filter(d => d.date === dayFilter) : days
  const hourOffset = dayFilter ? allHours.findIndex(h => h.time === displayedDays[0]?.hours[0]?.time) : 0
  const isSelected = day => Boolean(tijdvak && day.best_window && tijdvak.startIdx === allHours.findIndex(h => h.time === day.best_window.start))

  return {
    data, loading, error, sources, toggleSource, showBreakdown, setBreakdown, weights, aiScores,
    tijdvak, dragTijdvak, tijdvakHours, tijdvakAvg, nextBest, goToNextBest,
    dayFilter, setDayFilter, displayedDays, hourOffset, selectBestMoment, isSelected,
  }
}
