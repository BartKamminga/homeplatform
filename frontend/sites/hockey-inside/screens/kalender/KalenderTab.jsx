import { useState, useEffect, useCallback } from 'react'
import { api } from '@core/api.js'
import DagView from './DagView.jsx'
import WeekView from './WeekView.jsx'
import MaandView from './MaandView.jsx'
import JaarView from './JaarView.jsx'

const VIEWS = [
  { key: 'dag',    label: 'Dag' },
  { key: 'week',   label: 'Week' },
  { key: 'maand',  label: 'Maand' },
  { key: 'jaar',   label: 'Jaar' },
]

// LOKALE datumcomponenten, NIET toISOString() (UTC) - alle datums hier komen
// uit lokale Date-rekenkunde (setDate/getDay/new Date(y,m,d)). In CEST
// (UTC+2) schuift een lokale middernacht via toISOString terug naar 22:00 de
// vorige UTC-dag, dus elk bereik vroeg stilzwijgend 1 dag te vroeg op - de
// nauwe Dag-view-fetch sneed daardoor bijna alle wedstrijden van de
// eigenlijke geselecteerde dag eraf (backend behandelt "to" als exacte
// middernacht, niet einde-van-dag).
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Bereik afstemmen op de actieve weergave i.p.v. altijd de volle +/-45 dagen
// op te vragen - met manual-profile publicaties meegeteld (item: Week/Maand
// echte wedstrijdaantallen) groeide de brede fetch naar ~900 poules/3,5MB,
// merkbaar traag voor een view die maar 1 dag of 1 week nodig heeft.
function computeRange(view, date) {
  const d = new Date(date)
  if (view === 'week') {
    const offset = (d.getDay() + 6) % 7 // maandag = 0
    const from = new Date(d); from.setDate(from.getDate() - offset - 1)
    const to = new Date(from); to.setDate(to.getDate() + 9)
    return { from, to }
  }
  if (view === 'maand') {
    const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
    const startOffset = (firstOfMonth.getDay() + 6) % 7
    const from = new Date(firstOfMonth); from.setDate(from.getDate() - startOffset - 2)
    const to = new Date(from); to.setDate(to.getDate() + 44)
    return { from, to }
  }
  if (view === 'jaar') {
    return { from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear(), 11, 31) }
  }
  // dag (default)
  const from = new Date(d); from.setDate(from.getDate() - 1)
  const to = new Date(d); to.setDate(to.getDate() + 1)
  return { from, to }
}

// item 1009: 1 fetch per (view, datum)-combinatie, alle vier de weergaven
// aggregeren client-side uit dezelfde dataset i.p.v. aparte endpoints per
// zoom-niveau - maar wel met een bereik dat bij de weergave past (zie
// computeRange), anders schaalt dit niet met het aantal poules.
export default function KalenderTab({ onNavigateToDebug }) {
  const [view, setView] = useState('dag')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { from, to } = computeRange(view, selectedDate)
  const fromStr = toDateStr(from)
  const toStr = toDateStr(to)

  const load = useCallback(() => {
    api.get(`/api/hockey/vanger/scan-calendar?from=${fromStr}&to=${toStr}`).then(d => {
      setData(d)
      setError('')
    }).catch(e => setError(e.message || 'Laden mislukt')).finally(() => setLoading(false))
  }, [fromStr, toStr])

  useEffect(() => {
    setLoading(true)
    load()
    // item 1009: minder tijdkritisch dan de Scout-status-poll (8s) - dit is
    // een overzicht, geen live-regieknop, dus een ruimere cadans volstaat.
    const t = setInterval(load, 45000)
    return () => clearInterval(t)
  }, [load])

  function goToDay(date) {
    setSelectedDate(date)
    setView('dag')
  }
  function goToMonth(date) {
    setSelectedDate(date)
    setView('maand')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              padding: '5px 12px', fontSize: 12, fontWeight: view === v.key ? 600 : 400,
              borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: view === v.key ? 'var(--color-primary)' : 'var(--color-surface)',
              color: view === v.key ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {v.label}
          </button>
        ))}
        {loading && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Laden…</span>}
        {error && <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{error}</span>}
      </div>

      {data && view === 'dag'   && <DagView data={data} date={selectedDate} onDateChange={setSelectedDate} onNavigateToDebug={onNavigateToDebug} />}
      {data && view === 'week'  && <WeekView data={data} date={selectedDate} onDateChange={setSelectedDate} onSelectDay={goToDay} />}
      {data && view === 'maand' && <MaandView data={data} date={selectedDate} onDateChange={setSelectedDate} onSelectDay={goToDay} />}
      {data && view === 'jaar'  && <JaarView data={data} onSelectMonth={goToMonth} />}
    </div>
  )
}

export { toDateStr }
