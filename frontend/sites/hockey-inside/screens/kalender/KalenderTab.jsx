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

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

// item 1009: 1 brede fetch (huidig seizoen-achtig venster), alle vier de
// weergaven aggregeren client-side uit dezelfde dataset i.p.v. aparte
// endpoints per zoom-niveau.
export default function KalenderTab() {
  const [view, setView] = useState('dag')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/api/hockey/vanger/scan-calendar').then(d => {
      setData(d)
      setError('')
    }).catch(e => setError(e.message || 'Laden mislukt')).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
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

      {data && view === 'dag'   && <DagView data={data} date={selectedDate} onDateChange={setSelectedDate} />}
      {data && view === 'week'  && <WeekView data={data} date={selectedDate} onDateChange={setSelectedDate} onSelectDay={goToDay} />}
      {data && view === 'maand' && <MaandView data={data} date={selectedDate} onDateChange={setSelectedDate} onSelectDay={goToDay} />}
      {data && view === 'jaar'  && <JaarView data={data} onSelectMonth={goToMonth} />}
    </div>
  )
}

export { toDateStr }
