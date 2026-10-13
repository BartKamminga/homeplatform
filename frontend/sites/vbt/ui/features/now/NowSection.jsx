// NOW: wat er nu gebeurt. Tijdens een workout: blokkengrafiek (klik = springen), interval en doelen.
// Vrije rit: ritstand. Buiten een rit: snelstart.
import CanvasChart from '../../common/CanvasChart.jsx'
import { useVbt, actions, isRiding } from '../../hooks/useVbt.js'
import { fmtDur } from '../../common/format.js'

const stepText = st => !st ? 'FINISH'
  : (st.a === st.b ? st.a + '%' : st.a + '-' + st.b + '%') + ' · ' + fmtDur(st.d) + (st.c ? ' · ' + st.c + ' RPM' : '')

export default function NowSection() {
  const s = useVbt()
  const riding = isRiding(s.state)
  const wo = riding ? actions().currentWorkout() : null

  if (!riding) {
    return (
      <div className="pn-section">
        <p className="pn-hint">No ride running.</p>
        <div className="pn-buttons">
          <button className="ridebtn" onClick={() => actions().startFreeRide()}>&#9654; FREE RIDE</button>
          <button className="ghostbtn" onClick={() => actions().openPlan()}>&#9638; TRAINING PLAN</button>
          <button className="ghostbtn" onClick={() => actions().openRides()}>&#9776; MY RIDES</button>
        </div>
      </div>
    )
  }

  const run = s.run
  const progress = run && run.total ? run.elapsed / run.total : 0
  return (
    <div className="pn-section">
      <div className="pn-kv">
        <span>{run && !run.free ? run.name.toUpperCase() : 'FREE RIDE'}</span>
        <b>{fmtDur(s.rideTime)}</b>
      </div>
      {wo && !wo.free && (
        <>
          <CanvasChart height={70} title="Click an interval to jump there"
            draw={(ctx, w, h) => window.VBT.workout.drawChart(ctx, wo, w, h, progress)}
            onClick={frac => actions().jumpTo(actions().stepAt(wo, frac))} />
          {run.target && (
            <div className="pn-grid">
              <div><small>TARGET</small><b>{run.target.watts} W</b><i>{Math.round(run.target.pct)}% FTP</i></div>
              <div><small>CADENCE</small><b>{run.target.cadence ? run.target.cadence + ' RPM' : 'ANY'}</b><i>score {run.cadScore}%</i></div>
              <div><small>INTERVAL</small><b>{fmtDur(run.target.remaining)}</b><i>{run.index + 1} / {wo.steps.length}</i></div>
              <div><small>NEXT</small><b className="pn-small">{stepText(run.target.next)}</b></div>
            </div>
          )}
          <div className="pn-kv"><span>WORKOUT LEFT</span><b>{fmtDur(run.total - run.elapsed)}</b></div>
        </>
      )}
      <div className="pn-grid">
        <div><small>POWER</small><b>{s.watts} W</b><i>3s {s.avg3s} W</i></div>
        <div><small>DISTANCE</small><b>{(s.dist / 1000).toFixed(2)} KM</b><i>{s.speed.toFixed(1)} km/h</i></div>
        <div><small>{s.ghost.label}</small><b>{s.ghost.gap > 0 ? '+' : ''}{Math.round(s.ghost.gap)} M</b></div>
        <div><small>BUNCH</small><b>{s.bunch.inBunch ? 'IN' : Math.round(s.bunch.gap) + ' M'}</b></div>
      </div>
      <div className="pn-buttons">
        {s.state === 'ride' && <button className="ghostbtn" onClick={() => actions().pause()}>&#10074;&#10074; PAUSE</button>}
        {s.state === 'paused' && !s.autoPaused && <button className="ghostbtn" onClick={() => actions().resume()}>&#9654; RESUME</button>}
        <button className="ghostbtn danger" onClick={() => actions().stop()}>&#9632; STOP RIDE</button>
      </div>
    </div>
  )
}
