// MY PLAN: het actieve plan (WEEK x OF y, voortgang, startdatum), wisselen van plan met een startdatum
// (voortgang per plan blijft bewaard) en de kalender; klik op een workout voor het detail.
import { useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { useCalendar } from '../../hooks/useVbt.js'
import { minutes, dayLabel } from '../../common/format.js'
import { WorkoutDetail } from '../workouts/WorkoutDetail.jsx'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function SwitchPlan({ cal, onDone }) {
  const VBT = window.VBT
  const starts = VBT.settings.values.planStarts || {}
  const others = cal.plans.filter(p => p.slug !== cal.planSlug)
  const [slug, setSlug] = useState(others[0]?.slug || '')
  const [date, setDate] = useState(starts[others[0]?.slug] || VBT.calendar.nextMonday())
  const pick = s => { setSlug(s); setDate(starts[s] || VBT.calendar.nextMonday()) }
  const go = async () => { await VBT.calendar.switchPlan(slug, date); onDone() }
  if (!others.length) return <p className="pn-hint">There are no other plans.</p>
  return (
    <div id="planSwitch" className="pn-switch">
      <label>PLAN <select value={slug} onChange={e => pick(e.target.value)}>
        {others.map(p => <option key={p.slug} value={p.slug}>{p.name}{starts[p.slug] ? ' (started ' + starts[p.slug] + ')' : ''}</option>)}
      </select></label>
      <label>START <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <p className="pn-hint">{starts[slug] ? 'You started this plan before; keep that date to continue where you left off.' : 'A plan starts on a Monday; your progress in the current plan is kept.'}</p>
      <div className="pn-buttons">
        <button className="ghostbtn" onClick={onDone}>CANCEL</button>
        <button id="planSwitchGo" className="ridebtn" disabled={!slug || !date} onClick={go}>SWITCH PLAN</button>
      </div>
    </div>
  )
}

function DayCard({ wo, cal, selected, onSelect }) {
  const VBT = window.VBT
  const date = VBT.calendar.dateFor(wo), d = VBT.calendar.iso(date), today = VBT.calendar.iso(new Date())
  const done = cal.done[wo.id]
  const cls = 'wcard' + (wo.rest ? ' rest' : '') + (done ? ' done' : '') + (d === today ? ' today' : '') +
    (selected ? ' selected' : '') + (!wo.rest && !done && d < today ? ' missed' : '')
  return (
    <button className={cls} onClick={wo.rest ? undefined : () => onSelect(wo)}>
      <span className="wdate">{dayLabel(date)}</span><b>{wo.name.toUpperCase()}</b>
      {!wo.rest && <span className="wmeta">{minutes(wo.duration)} · TSS {VBT.workout.tss(wo)}</span>}
      {!wo.rest && <CanvasChart height={26} className="wmini" draw={(ctx, w, h) => VBT.workout.drawChart(ctx, wo, w, h)} />}
      {done && <i className="wcheck">&#10003;</i>}
    </button>
  )
}

export default function PlanSection() {
  const VBT = window.VBT
  const cal = useCalendar()
  const t = VBT.calendar.today()
  const [selId, setSelId] = useState(null)
  const [switching, setSwitching] = useState(false)
  const { plan } = cal
  const meta = cal.plans.find(p => p.slug === cal.planSlug)
  const selected = (selId && VBT.calendar.find(selId)) || t.today || t.next
  const pct = cal.total ? Math.round(cal.doneCount / cal.total * 100) : 0

  return (
    <div className="pn-section">
      <div className="pn-planhead">
        <div>
          <small>ACTIVE PLAN · {t.week ? 'WEEK ' + t.week + ' OF ' + plan.weeks.length : plan.weeks.length + ' WEEKS'}</small>
          <h3 id="planTitle">{(plan.name || meta?.name || 'TRAINING PLAN').toUpperCase()}</h3>
          <div className="pn-progress"><i style={{ width: pct + '%' }} /></div>
          <small id="planProgress">{cal.doneCount} / {cal.total} DONE · FTP {cal.ftp} W
            {(plan.source || meta?.sourceUrl) && <> · <a href={plan.source || meta.sourceUrl} target="_blank" rel="noopener noreferrer">SOURCE</a></>}</small>
        </div>
        <div className="pn-planctl">
          <label>START <input id="planStart" type="date" value={cal.startDate} onChange={e => VBT.calendar.setStartDate(e.target.value)} /></label>
          {!switching && <button id="planSwitchOpen" className="ghostbtn" onClick={() => setSwitching(true)}>&#8644; SWITCH PLAN</button>}
        </div>
      </div>
      {switching && <SwitchPlan cal={cal} onDone={() => { setSwitching(false); setSelId(null) }} />}

      <div className="pn-plangrid">
        <div className="wrow wdays"><span className="wlabel"></span>{DAYS.map(d => <span key={d}>{d}</span>)}</div>
        {plan.weeks.map((days, wi) => (
          <div key={wi} className={'wrow' + (t.week === wi + 1 ? ' thisweek' : '')}>
            <span className="wlabel">WEEK {wi + 1}</span>
            {DAYS.map((_, dow) => {
              const di = plan.dayOffsets.indexOf(dow)
              return di >= 0 && days[di]
                ? <DayCard key={dow} wo={days[di]} cal={cal} selected={selected === days[di]} onSelect={wo => setSelId(wo.id)} />
                : <span key={dow} className="wempty" />
            })}
          </div>
        ))}
      </div>
      {selected && <div className="pn-sticky"><WorkoutDetail wo={selected} /></div>}
    </div>
  )
}
