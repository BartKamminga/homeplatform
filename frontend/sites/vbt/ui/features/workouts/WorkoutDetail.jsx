// Detail van een workout (plan of bibliotheek) of een climb: grafiek/profiel, gegevens en RIDE.
// Workout: klik in de grafiek = starten bij dat interval. Plan-item: MARK DONE / UNMARK.
import { useEffect, useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { actions } from '../../hooks/useVbt.js'
import { fmtDur, minutes, dayLabel, startWithConfirm } from '../../common/format.js'

export function ClimbDetail({ climb }) {
  const VBT = window.VBT
  const [full, setFull] = useState(null)
  const [pb, setPb] = useState(null)
  useEffect(() => {
    let alive = true
    setFull(null)
    setPb(null)
    VBT.climbs.get(climb.slug).then(c => { if (alive) setFull(c) }).catch(() => {})
    VBT.storage.bestLap('climb-' + climb.slug).then(b => { if (alive) setPb(b) }).catch(() => {})
    return () => { alive = false }
  }, [climb.slug])
  const c = full || climb
  return (
    <div id="planDetail" className="pn-detail">
      <div className="dhead"><div>
        <small>LIBRARY · CLIMB TRAINING{c.category ? ' · CAT ' + c.category : ''}</small>
        <h3>{c.name.toUpperCase()}</h3>
        <span>{VBT.climbs.meta(c)}{c.maxGrade ? ' · MAX ' + c.maxGrade + '%' : ''} · SIM</span>
        {pb && pb.lapTime && <span className="dres">PB {fmtDur(pb.lapTime)} · {pb.avgW} W AVG</span>}
      </div></div>
      <CanvasChart height={110} draw={(ctx, w, h) => VBT.climbs.drawProfile(ctx, c, w, h)} />
      <div className="pn-buttons">
        <button id="climbRide" className="ridebtn" disabled={!full}
          onClick={() => startWithConfirm(c.name, () => actions().startWorkout(full))}>RIDE &#9654;</button>
      </div>
    </div>
  )
}

// preview = { name, dateFor }: workout uit een plan dat je bekijkt maar (nog) niet volgt - geen MARK DONE
export function WorkoutDetail({ wo, preview }) {
  const VBT = window.VBT
  const cal = VBT.calendar
  const inPlan = !!wo.week
  const done = inPlan && cal.getState().done[wo.id]
  const where = preview ? preview.name.toUpperCase() + ' · WEEK ' + wo.week + ' · DAY ' + wo.day + ' · ' + dayLabel(preview.dateFor(wo))
    : inPlan ? 'WEEK ' + wo.week + ' · DAY ' + wo.day + ' · ' + dayLabel(cal.dateFor(wo))
    : 'LIBRARY · ' + (wo.source === 'zwo' ? 'IMPORTED .ZWO' : String(wo.source || '').toUpperCase())
  const start = step => startWithConfirm(wo.name, () => actions().startWorkout(wo, step))
  return (
    <div id="planDetail" className="pn-detail">
      <div className="dhead"><div>
        <small>{where}</small>
        <h3>{wo.name.toUpperCase()}</h3>
        <span>{minutes(wo.duration)} · TSS {VBT.workout.tss(wo)} · {wo.free ? 'FREE RIDE' : VBT.ftp.testType(wo) ? 'FTP TEST' : 'ERG'}</span>
        {done && <span className="dres">&#10003; {done.date}{done.avgW ? ' · ' + done.avgW + ' W AVG' : ''}{done.score ? ' · CADENCE ' + done.score + '%' : ''}</span>}
      </div></div>
      {!wo.free && <CanvasChart height={110} title="Click an interval to start the ride there"
        draw={(ctx, w, h) => VBT.workout.drawChart(ctx, wo, w, h)}
        onClick={frac => start(VBT.workout.stepAtFraction(wo, frac))} />}
      <div className="pn-buttons">
        {inPlan && !preview && <button id="planUndo" className="ghostbtn" onClick={() => cal.toggleDone(wo.id)}>{done ? 'UNMARK' : 'MARK DONE'}</button>}
        <button id="planRide" className="ridebtn" onClick={() => start()}>RIDE &#9654;</button>
      </div>
    </div>
  )
}
