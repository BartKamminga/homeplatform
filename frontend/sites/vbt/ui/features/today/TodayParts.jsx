// Onderdelen van TODAY (items 1343/1306): gemiste workout verplaatsen (voorstel, jij bevestigt), hoe voel je je
// (met voorstel voor een kortere variant), en de weekstrook (wat staat er deze week, wat is gedaan of gemist).
import { dayLabel, minutes } from '../../common/format.js'
import { READINESS } from '../rides/feedback.js'

export function MissedProposal() {
  const P = window.VBT.planAdapt, C = window.VBT.calendar
  const m = P.missed()[0]
  if (!m) return null
  const to = P.nextFreeDay(m.id)
  const more = P.missed().length - 1
  return (
    <div id="missedProposal" className="pn-notice">
      <small>MISSED · {dayLabel(C.dateFor(m))}{more > 0 ? ' · +' + more + ' MORE' : ''}</small>
      <b>{m.name.toUpperCase()} · {minutes(m.duration)}</b>
      <span>{to ? 'Move it to ' + dayLabel(to) + '?' : 'No free day in the next 3 weeks - skip it?'}</span>
      <div className="pn-buttons">
        {to && <button id="missedMove" className="ridebtn" onClick={() => P.moveTo(m.id, C.iso(to))}>MOVE TO {dayLabel(to).slice(0, 3)}</button>}
        <button id="missedSkip" className="ghostbtn" onClick={() => P.skip(m.id)}>SKIP</button>
      </div>
    </div>
  )
}

export function ReadinessRow() {
  const P = window.VBT.planAdapt
  const cur = P.readinessToday()
  return (
    <div className="pn-readiness">
      <small>HOW DO YOU FEEL TODAY?</small>
      <div className="readiness">
        {READINESS.map(r => (
          <button key={r.v} data-ready={r.v} className={cur === r.v ? 'on' : ''} onClick={() => P.setReadiness(r.v)}>{r.label}</button>
        ))}
      </div>
    </div>
  )
}

// voorstel uit readiness/RPE: alleen een voorstel, jij kiest
export function Suggestion({ s, taken, onTake, onKeep }) {
  if (!s) return null
  return (
    <div id="todaySuggestion" className="pn-notice soft">
      <span>{s.why} - how about the <b>{s.variant.variant} MIN</b> version?</span>
      <div className="pn-buttons">
        {!taken && <button id="takeSuggestion" className="ridebtn" onClick={onTake}>TAKE {s.variant.variant} MIN</button>}
        {taken && <button className="ghostbtn" onClick={onKeep}>BACK TO ORIGINAL</button>}
      </div>
    </div>
  )
}

export function WeekStrip() {
  const VBT = window.VBT, C = VBT.calendar, P = VBT.planAdapt
  const cal = C.getState(), today = C.iso(new Date())
  const monday = new Date(); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const items = cal.plan.weeks.flat().filter(w => !w.rest)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(d.getDate() + i)
    const iso = C.iso(d), wos = items.filter(w => C.iso(C.dateFor(w)) === iso)
    const st = !wos.length ? 'rest' : wos.every(w => cal.done[w.id]) ? 'done' : wos.every(w => cal.done[w.id] || P.isSkipped(w.id)) ? 'skipped'
      : iso < today ? 'missed' : 'planned'
    return { d, iso, wos, st, avail: P.minutesOn(d) }
  })
  const n = days.reduce((a, x) => a + x.wos.length, 0), nd = days.reduce((a, x) => a + x.wos.filter(w => cal.done[w.id]).length, 0)
  return (
    <div className="pn-weekstrip">
      <small>THIS WEEK · {nd} / {n} DONE</small>
      <div className="wsdays">
        {days.map(x => (
          <span key={x.iso} className={'wsday ' + x.st + (x.iso === today ? ' today' : '')}
            title={x.wos.map(w => w.name).join(', ') || 'Rest'}>
            <i>{dayLabel(x.d).slice(0, 3)}</i>
            <b>{x.st === 'done' ? '✓' : x.st === 'missed' ? '!' : x.st === 'skipped' ? '–' : x.wos.length ? Math.round(x.wos[0].duration / 60) + "'" : '·'}</b>
            {x.avail !== null && <em>{x.avail ? x.avail + "'" : 'OFF'}</em>}
          </span>
        ))}
      </div>
    </div>
  )
}
