// Feedback-keuze: RPE 1-10 (kleur van makkelijk naar max) en hoe je je voelt. Op het finish-scherm en in MY RIDES.
import { useState } from 'react'
import { RPE, READINESS, saveFeedback, rpeInfo } from './feedback.js'

export default function Feedback({ ride, compact }) {
  const [, redraw] = useState(0)
  const set = patch => { saveFeedback(ride, patch); redraw(n => n + 1) }
  const info = rpeInfo(ride.rpe)
  const load = ride.rpe && ride.duration ? Math.round(ride.rpe * ride.duration / 60) : null
  return (
    <div id="rideFeedback" className={'pn-feedback' + (compact ? ' compact' : '')}>
      <small>HOW HARD WAS IT? <em>1-0</em>{info && <b style={{ color: info.color }}> {ride.rpe} · {info.label}</b>}</small>
      <div className="rpe">
        {RPE.map(r => (
          <button key={r.v} data-rpe={r.v} className={ride.rpe === r.v ? 'on' : ''} style={{ '--c': r.color }}
            title={r.label} onClick={() => set({ rpe: r.v })}>{r.v}</button>
        ))}
      </div>
      <small>HOW DO YOU FEEL?</small>
      <div className="readiness">
        {READINESS.map(r => (
          <button key={r.v} data-readiness={r.v} className={ride.readiness === r.v ? 'on' : ''} onClick={() => set({ readiness: r.v })}>{r.label}</button>
        ))}
      </div>
      {load && !compact && <small className="load">TRAINING LOAD {load} <i>(RPE × minutes)</i></small>}
    </div>
  )
}
