// MY RIDES in weekweergave (zoals de plankalender): per week een rij MA-ZO met de ritten van die dag,
// links de weektotalen. Nieuwste week bovenaan; MORE WEEKS laadt oudere weken.
import { useState } from 'react'
import { fmtDur, dayLabel, mondayOf, WEEKDAYS as DAYS } from '../../common/format.js'

const WEEK_MS = 7 * 86400000
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')

export default function RidesWeeks({ items, selected, onSelect }) {
  const [count, setCount] = useState(8)
  const thisMonday = mondayOf(new Date())
  const oldest = items.length ? mondayOf(new Date(items[items.length - 1].startedAt)) : thisMonday
  const total = Math.max(1, Math.round((thisMonday - oldest) / WEEK_MS) + 1)
  const weeks = Array.from({ length: Math.min(count, total) }, (_, i) => {
    const start = new Date(thisMonday); start.setDate(start.getDate() - i * 7)
    const days = DAYS.map((_, d) => { const day = new Date(start); day.setDate(day.getDate() + d); return { date: day, rides: [] } })
    return { start, days, n: 0, sec: 0, kj: 0, km: 0 }
  })
  for (const r of items) {
    const d = new Date(r.startedAt)
    const w = weeks.find(x => x.start.getTime() === mondayOf(d).getTime())
    if (!w) continue
    w.days[(d.getDay() + 6) % 7].rides.push(r)
    w.n++; w.sec += r.duration || 0; w.kj += r.kj || 0; w.km += (r.distance || 0) / 1000
  }
  const today = new Date().toDateString()

  return (
    <div className="pn-plangrid pn-rideweeks">
      <div className="wrow wdays"><span className="wlabel"></span>{DAYS.map(d => <span key={d}>{d}</span>)}</div>
      {weeks.map(w => (
        <div key={w.start.getTime()} className={'wrow' + (w.start.getTime() === thisMonday.getTime() ? ' thisweek' : '')}>
          <span className="wlabel wtotals">
            {w.start.getTime() === thisMonday.getTime() ? 'THIS WEEK' : dayLabel(w.start).slice(4)}
            {w.n > 0 && <small>{w.n} {w.n === 1 ? 'RIDE' : 'RIDES'}<br />{fmtDur(w.sec)}<br />{w.kj} KJ · {w.km.toFixed(0)} KM</small>}
          </span>
          {w.days.map(day => (
            <div key={day.date.getTime()} className={'wday' + (day.date.toDateString() === today ? ' today' : '') + (day.rides.length ? '' : ' empty')}>
              <span className="wdate">{dayLabel(day.date)}</span>
              {day.rides.map(r => (
                <button key={r.id} className={'wcard ridecard' + (r.id === selected ? ' selected' : '')} onClick={() => onSelect(r.id)}>
                  <span className="wmeta">{hhmm(new Date(r.startedAt))}{r.pending ? ' · NOT SYNCED' : ''}</span>
                  <b>{(r.name || 'Ride').toUpperCase()}</b>
                  <span className="wmeta">{fmtDur(r.duration)} · {(r.distance / 1000).toFixed(1)} KM · {r.avgW} W</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
      {count < total && <button id="ridesMoreWeeks" className="ghostbtn" onClick={() => setCount(c => c + 8)}>MORE WEEKS</button>}
    </div>
  )
}
