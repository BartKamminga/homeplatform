// MY PLAN: het actieve plan (WEEK x OF y, voortgang, startdatum) en de kalender; via de plannenrij ook door
// andere plannen bladeren (voorbeeld met RIDE per workout) en wisselen met een startdatum (voortgang per plan
// blijft bewaard). Klik op een workout voor het detail.
import { useEffect, useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { useCalendar } from '../../hooks/useVbt.js'
import { minutes, dayLabel, parseIso, WEEKDAYS as DAYS } from '../../common/format.js'
import { WorkoutDetail } from '../workouts/WorkoutDetail.jsx'
import { AvailabilityEditor, MoveBar } from './PlanParts.jsx'

function SwitchPlan({ cal, initial, onDone }) {
  const VBT = window.VBT
  const starts = VBT.settings.values.planStarts || {}
  const others = cal.plans.filter(p => p.slug !== cal.planSlug)
  const first = initial || others[0]?.slug || ''
  const [slug, setSlug] = useState(first)
  const [date, setDate] = useState(starts[first] || VBT.calendar.nextMonday())
  const pick = s => { setSlug(s); setDate(starts[s] || VBT.calendar.nextMonday()) }
  const go = async () => { await VBT.calendar.switchPlan(slug, date); onDone(true) }
  if (!others.length) return <p className="pn-hint">There are no other plans.</p>
  return (
    <div id="planSwitch" className="pn-switch">
      <label>PLAN <select value={slug} onChange={e => pick(e.target.value)}>
        {others.map(p => <option key={p.slug} value={p.slug}>{p.name}{starts[p.slug] ? ' (started ' + starts[p.slug] + ')' : ''}</option>)}
      </select></label>
      <label>START <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <p className="pn-hint">{starts[slug] ? 'You started this plan before; keep that date to continue where you left off.' : 'A plan starts on a Monday; your progress in the current plan is kept.'}</p>
      <div className="pn-buttons">
        <button className="ghostbtn" onClick={() => onDone(false)}>CANCEL</button>
        <button id="planSwitchGo" className="ridebtn" disabled={!slug || !date} onClick={go}>SWITCH PLAN</button>
      </div>
    </div>
  )
}

function DayCard({ wo, date, done, selected, onSelect }) {
  const VBT = window.VBT
  const d = VBT.calendar.iso(date), today = VBT.calendar.iso(new Date())
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

// datum van een workout in een plan dat start op 'start' (zelfde rekenregel als calendar.dateFor)
const dateIn = (plan, start) => wo => {
  const d = parseIso(start)
  d.setDate(d.getDate() + (wo.week - 1) * 7 + plan.dayOffsets[wo.day - 1])
  return d
}

export default function PlanSection() {
  const VBT = window.VBT
  const cal = useCalendar()
  const t = VBT.calendar.today()
  const [viewSlug, setViewSlug] = useState(cal.planSlug)
  const [other, setOther] = useState(null)        // geladen plan dat je bekijkt (niet het actieve)
  const [selId, setSelId] = useState(null)
  const [switching, setSwitching] = useState(false)
  const active = viewSlug === cal.planSlug

  useEffect(() => { setViewSlug(cal.planSlug); setSelId(null) }, [cal.planSlug])   // ander plan actief gemaakt
  useEffect(() => {
    if (active) { setOther(null); return }
    let alive = true
    setOther(null)
    VBT.storage.loadPlan(viewSlug).then(p => { if (alive) setOther(p) }).catch(() => {})
    return () => { alive = false }
  }, [viewSlug, active])

  const view = id => { setViewSlug(id); setSelId(null); setSwitching(false) }
  const plan = active ? cal.plan : other || { weeks: [], dayOffsets: [] }
  const meta = cal.plans.find(p => p.slug === viewSlug)
  const start = active ? cal.startDate : (VBT.settings.values.planStarts || {})[viewSlug] || VBT.calendar.nextMonday()
  const dateFor = active ? VBT.calendar.dateFor : dateIn(plan, start)
  const find = id => plan.weeks.flat().find(w => w.id === id)
  const selected = (selId && find(selId)) || (active ? t.today || t.next : plan.weeks.flat().find(w => !w.rest))
  const ids = plan.weeks.flat().filter(w => !w.rest).map(w => w.id)
  const doneCount = ids.filter(id => cal.done[id]).length
  const pct = ids.length ? Math.round(doneCount / ids.length * 100) : 0
  const byDate = {}
  if (active) plan.weeks.flat().filter(w => !w.rest).forEach(w => { const k = VBT.calendar.iso(dateFor(w)); (byDate[k] = byDate[k] || []).push(w) })
  const placed = (wi, dow) => {
    const d = parseIso(start); d.setDate(d.getDate() + wi * 7 + dow)
    return (byDate[VBT.calendar.iso(d)] || [])[0] || null
  }

  return (
    <div className="pn-section">
      <div className="pn-chips pn-plans">
        {cal.plans.map(p => (
          <button key={p.slug} data-plan={p.slug} className={(p.slug === viewSlug ? 'active' : '') + (p.slug === cal.planSlug ? ' current' : '')} onClick={() => view(p.slug)}>
            {p.name.toUpperCase()}{p.slug === cal.planSlug && <em> ACTIVE</em>}
          </button>
        ))}
      </div>
      <div className="pn-planhead">
        <div>
          <small>{active ? 'ACTIVE PLAN · ' + (t.week ? 'WEEK ' + t.week + ' OF ' + plan.weeks.length : plan.weeks.length + ' WEEKS')
            : 'PREVIEW · ' + plan.weeks.length + ' WEEKS · FROM ' + dayLabel(parseIso(start))}</small>
          <h3 id="planTitle">{(plan.name || meta?.name || 'TRAINING PLAN').toUpperCase()}</h3>
          <div className="pn-progress"><i style={{ width: pct + '%' }} /></div>
          <small id="planProgress">{doneCount} / {ids.length} DONE · FTP {cal.ftp} W
            {(plan.source || meta?.sourceUrl) && <> · <a href={plan.source || meta.sourceUrl} target="_blank" rel="noopener noreferrer">SOURCE</a></>}</small>
        </div>
        <div className="pn-planctl">
          {active && <label>START <input id="planStart" type="date" value={cal.startDate} onChange={e => VBT.calendar.setStartDate(e.target.value)} /></label>}
          {!switching && (active
            ? <button id="planSwitchOpen" className="ghostbtn" onClick={() => setSwitching(true)}>&#8644; SWITCH PLAN</button>
            : <button id="planStartThis" className="ridebtn" onClick={() => setSwitching(true)}>START THIS PLAN</button>)}
        </div>
      </div>
      {switching && <SwitchPlan cal={cal} initial={active ? null : viewSlug} onDone={ok => { setSwitching(false); setSelId(null); if (ok) setViewSlug(VBT.calendar.getState().planSlug) }} />}
      {!active && !other && <p className="pn-hint">Loading plan...</p>}
      {active && <AvailabilityEditor />}

      <div className="pn-plangrid">
        <div className="wrow wdays"><span className="wlabel"></span>{DAYS.map(d => <span key={d}>{d}</span>)}</div>
        {plan.weeks.map((days, wi) => (
          <div key={wi} className={'wrow' + (active && t.week === wi + 1 ? ' thisweek' : '')}>
            <span className="wlabel">WEEK {wi + 1}</span>
            {DAYS.map((_, dow) => {
              // actief plan: op de echte datum (verplaatst = andere kolom, 1306); voorbeeld: volgens het plan
              const wo = active ? placed(wi, dow) : (plan.dayOffsets.indexOf(dow) >= 0 && days[plan.dayOffsets.indexOf(dow)])
              return wo
                ? <DayCard key={dow} wo={wo} date={dateFor(wo)} done={cal.done[wo.id]} selected={selected === wo} onSelect={w => setSelId(w.id)} />
                : <span key={dow} className="wempty" />
            })}
          </div>
        ))}
      </div>
      {selected && <div className="pn-sticky"><WorkoutDetail wo={selected} preview={active ? null : { name: plan.name || viewSlug, dateFor }} />{active && <MoveBar wo={selected} />}</div>}
    </div>
  )
}
