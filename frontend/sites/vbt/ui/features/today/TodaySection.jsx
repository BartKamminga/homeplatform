// TODAY = wat ga ik nu doen (item 1343): de workout van vandaag (passend gemaakt op je beschikbaarheid, met
// varianten), gemiste workouts verplaatsen (voorstel), hoe voel je je (met voorstel), de weekstrook, en
// alternatieven (vrije rit, willekeurige klim, workouts) plus je laatste rit.
import { useEffect, useState } from 'react'
import { actions, useCalendar } from '../../hooks/useVbt.js'
import { fmtDur, fmtDateTime, dayLabel, startWithConfirm } from '../../common/format.js'
import { WorkoutDetail, ClimbDetail } from '../workouts/WorkoutDetail.jsx'
import { MissedProposal, ReadinessRow, Suggestion, WeekStrip } from './TodayParts.jsx'

const HEADLINE = {
  workout: "TODAY'S WORKOUT",
  done: 'DONE FOR TODAY',
  rest: 'REST DAY',
  before: 'PLAN STARTS SOON',
  behind: 'CATCH UP',
  finished: 'PLAN FINISHED',
  none: 'NO PLAN',
}

export default function TodaySection({ onSection }) {
  const VBT = window.VBT
  const cal = useCalendar()
  const t = VBT.calendar.today()
  const [climb, setClimb] = useState(null)
  const [rides, setRides] = useState([])
  const [taken, setTaken] = useState(false)

  useEffect(() => {
    let alive = true
    actions().listRides().then(list => { if (alive) setRides(list || []) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const randomClimb = async () => {
    const list = await VBT.climbs.load().catch(() => [])
    if (list.length) setClimb(list[Math.floor(Math.random() * list.length)])
  }

  const planned = t.status === 'workout' ? t.today : t.next
  // beschikbaarheid (automatisch) en readiness/RPE (voorstel) - alleen voor de workout van vandaag
  const isToday = planned && VBT.calendar.iso(VBT.calendar.dateFor(planned)) === VBT.calendar.iso(new Date())
  const fitted = isToday ? VBT.planAdapt.fitted(planned) : null
  const base = fitted || planned
  const sug = isToday ? VBT.planAdapt.suggestion(base, rides) : null
  const wo = taken && sug ? sug.variant : base
  const lastRide = rides[0]

  const sub = {
    workout: 'Week ' + t.week + ' of ' + cal.plan.weeks.length + ' · ' + (cal.plan.name || ''),
    done: 'Nice work. Next up:',
    rest: 'Recover, or pick something light below. Next up:',
    before: 'Your plan starts on ' + (planned ? dayLabel(VBT.calendar.dateFor(planned)) : cal.startDate) + '. First workout:',
    behind: 'You missed some workouts. Pick up where you left off:',
    finished: 'All ' + cal.total + ' workouts done. Do an FTP test or pick a new plan under MY PLAN.',
    none: 'Choose a training plan under MY PLAN.',
  }[t.status]

  return (
    <div className="pn-section">
      <div className="pn-today">
        <small>{dayLabel(new Date())} · FTP {cal.ftp} W · {cal.doneCount} / {cal.total} DONE</small>
        <h3>{HEADLINE[t.status]}</h3>
        <p className="pn-hint">{sub}</p>
      </div>
      <WeekStrip />
      <MissedProposal />
      {isToday && <ReadinessRow />}
      {fitted && <p className="pn-hint" id="fittedNote">Fitted to the {VBT.planAdapt.minutesOn(new Date())} min you have today (set under MY PLAN).</p>}
      <Suggestion s={sug} taken={taken} onTake={() => setTaken(true)} onKeep={() => setTaken(false)} />
      {wo && !climb && <WorkoutDetail wo={wo} />}
      {climb && <ClimbDetail climb={climb} />}

      <h4>OR RIDE SOMETHING ELSE</h4>
      <div className="pn-buttons">
        <button id="todayFree" className="ghostbtn" onClick={() => startWithConfirm('a free ride', () => actions().startFreeRide())}>&#9654; FREE RIDE</button>
        <button id="todayClimb" className="ghostbtn" onClick={randomClimb}>&#9650; RANDOM CLIMB</button>
        {climb && wo && <button className="ghostbtn" onClick={() => setClimb(null)}>&#8634; BACK TO PLAN</button>}
        <button className="ghostbtn" onClick={() => onSection('workouts')}>&#9638; BROWSE WORKOUTS</button>
        {(t.status === 'finished' || t.status === 'none') && <button className="ghostbtn" onClick={() => onSection('plan')}>MY PLAN</button>}
      </div>

      {lastRide && (
        <>
          <h4>LAST RIDE</h4>
          <button className="riderow" onClick={() => onSection('rides')}>
            <span className="rdate">{fmtDateTime(lastRide.startedAt)}</span>
            <b>{(lastRide.name || 'Ride').toUpperCase()}</b>
            <span className="rmeta">{fmtDur(lastRide.duration)} · {(lastRide.distance / 1000).toFixed(1)} KM · {lastRide.avgW} W · {lastRide.kj} KJ</span>
          </button>
        </>
      )}
    </div>
  )
}
