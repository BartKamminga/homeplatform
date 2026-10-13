// TODAY: wat staat er vandaag op het plan. Rustdag/klaar/achter: de eerstvolgende workout plus alternatieven
// (vrije rit, willekeurige klim, door de workouts bladeren) en je laatste rit.
import { useEffect, useState } from 'react'
import { actions, useCalendar } from '../../hooks/useVbt.js'
import { fmtDur, fmtDateTime, dayLabel, startWithConfirm } from '../../common/format.js'
import { WorkoutDetail, ClimbDetail } from '../workouts/WorkoutDetail.jsx'

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
  const [lastRide, setLastRide] = useState(null)

  useEffect(() => {
    let alive = true
    actions().listRides().then(list => { if (alive) setLastRide(list[0] || null) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const randomClimb = async () => {
    const list = await VBT.climbs.load().catch(() => [])
    if (list.length) setClimb(list[Math.floor(Math.random() * list.length)])
  }

  const wo = t.status === 'workout' ? t.today : t.next
  const sub = {
    workout: 'Week ' + t.week + ' of ' + cal.plan.weeks.length + ' · ' + (cal.plan.name || ''),
    done: 'Nice work. Next up:',
    rest: 'Recover, or pick something light below. Next up:',
    before: 'Your plan starts on ' + (wo ? dayLabel(VBT.calendar.dateFor(wo)) : cal.startDate) + '. First workout:',
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
