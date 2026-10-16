// Detail van een rit in MY RIDES: knoppen (verwijderen/terugzetten, .FIT, Strava, CONTINUE RIDE alleen bij een
// rit die niet netjes is afgesloten), cijfers, feedback,
// grafiek (vermogen/hoogte/hartslag) en de pauzes en eventlog van die rit.
import CanvasChart from '../../common/CanvasChart.jsx'
import { actions } from '../../hooks/useVbt.js'
import { fmtDur, fmtDateTime, startWithConfirm } from '../../common/format.js'
import { confirmDialog } from '../../common/ConfirmDialog.jsx'
import { drawRide } from './rideChart.js'
import Feedback from './Feedback.jsx'
import HrStats from './HrStats.jsx'
import StravaRideButton from '../strava/StravaRideButton.jsx'

// readOnly: tijdens een rit alleen bekijken (en .FIT) - geen verwijderen, terugzetten of CONTINUE RIDE
export default function RideDetail({ ride, readOnly, onDeleted, onRestored }) {
  const stat = (v, l) => <div key={l}><b>{v}</b><small>{l}</small></div>
  const paused = Math.max(0, (ride.elapsed || 0) - ride.duration)
  const remove = async () => {
    if (!(await confirmDialog({ title: 'MOVE TO TRASH?', text: 'Ride of ' + fmtDateTime(ride.startedAt) + '. You can restore it from TRASH.', yes: 'DELETE', danger: true }))) return
    try { await actions().deleteRide(ride.id); onDeleted() } catch (e) { window.VBT.toast?.(e.message, 6000) }
  }
  const restore = async () => {
    try { await window.VBT.storage.restoreRide(ride.id); window.VBT.toast?.('RIDE RESTORED'); onRestored(ride.id) } catch (e) { window.VBT.toast?.(e.message, 6000) }
  }
  const canContinue = window.VBT.session.canContinue(ride)      // alleen niet netjes afgesloten ritten (item 1350)
  return (
    <div id="rideDetail" className="pn-detail">
      <div className="dhead">
        <div>
          <small>{fmtDateTime(ride.startedAt)}{ride.jumped ? ' · INTERVALS SKIPPED' : ''}</small>
          <h3>{(ride.name || 'Ride').toUpperCase()}</h3>
        </div>
      </div>
      <div className="pn-buttons">
        {!readOnly && (ride.deletedAt
          ? <button id="rideRestore" className="ridebtn" onClick={restore}>&#8634; RESTORE</button>
          : !ride.pending && <button id="rideDelete" className="ghostbtn" onClick={remove}>DELETE</button>)}
        <button id="rideFit" className="ghostbtn" disabled={!(ride.samples && ride.samples.length)} onClick={() => actions().downloadFit(ride)}>&#11015; .FIT</button>
        {!readOnly && !ride.deletedAt && !ride.pending && !ride.inProgress && <StravaRideButton ride={ride} />}
        {!readOnly && !ride.deletedAt && canContinue && <button id="rideContinue" className="ridebtn"
          title="This ride was not finished properly - continue where it stopped"
          onClick={() => startWithConfirm('this ride again', () => actions().resumeRide(ride))}>CONTINUE RIDE &#9654;</button>}
      </div>
      <div className="ridestats">
        {stat(fmtDur(ride.duration), 'TIME')}{stat((ride.distance / 1000).toFixed(2), 'KM')}{stat(ride.avgW, 'AVG W')}
        {stat(ride.maxW, 'MAX W')}{stat(ride.kj, 'KJ')}{stat(ride.avgCad, 'AVG RPM')}{stat(ride.avgHr || '-', 'AVG BPM')}
        {stat(ride.elevation, 'M UP')}
        {ride.elapsed ? <>{stat(fmtDur(ride.elapsed), 'ELAPSED')}{stat(fmtDur(paused), 'PAUSED')}</> : null}
        {ride.lapTime ? stat(fmtDur(ride.lapTime), ride.kind === 'climb' ? 'TO THE TOP' : 'BEST LAP') : null}
        {ride.score !== null && ride.score !== undefined ? stat(ride.score + '%', 'CADENCE') : null}
        <HrStats ride={ride} stat={stat} />
      </div>
      {!readOnly && !ride.deletedAt && !ride.pending && <Feedback key={'fb' + ride.id} ride={ride} compact />}
      <CanvasChart height={160} draw={(ctx, w, h) => drawRide(ctx, w, h, ride.samples)} />
      <div className="ridelogs">
        {!!(ride.pauses && ride.pauses.length) && (
          <details open><summary>PAUSES ({ride.pauses.length})</summary>
            <ul>{ride.pauses.map((p, i) => <li key={i}>{fmtDur(p.t)} · {p.reason} · {fmtDur(p.dur)}</li>)}</ul></details>)}
        {!!(ride.events && ride.events.length) && (
          <details><summary>EVENT LOG ({ride.events.length})</summary>
            <ul className="rideevents">{ride.events.map((e, i) => (
              <li key={i} data-level={e.level}><i>{new Date(e.t).toTimeString().slice(0, 8)}</i> {e.type} · {e.msg}</li>))}</ul></details>)}
      </div>
    </div>
  )
}
