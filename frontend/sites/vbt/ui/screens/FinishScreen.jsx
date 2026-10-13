// Eindscherm na een rit: samenvatting, FTP-voorstel na een FTP-test, .FIT, Strava, MY RIDES en CONTINUE.
// De rit zelf staat in VBT.game.lastRide (wordt na het opslaan aangevuld met serverId); de kop in game.finishInfo.
import { useEffect, useState } from 'react'
import { useVbt, actions } from '../hooks/useVbt.js'
import { fmtDur } from '../common/format.js'
import { useStrava, rideButton, buttonLabel } from '../features/strava/strava.js'
import Feedback from '../features/rides/Feedback.jsx'
import { saveFeedback, flushFeedback } from '../features/rides/feedback.js'

function FtpProposal({ ride }) {
  const VBT = window.VBT
  const [answer, setAnswer] = useState(null)
  const r = VBT.ftp.compute(ride), cur = VBT.cfg.rider.ftp
  if (!r || r.ftp < 50 || (r.ftp === cur && !answer) || answer === 'keep') return null
  if (answer === 'accept') {
    return <div id="ftpProposal" className="ftpprop"><b>FTP SET TO {r.ftp} W</b><span>All workouts now use your new FTP.</span></div>
  }
  const diff = r.ftp - cur
  const keep = () => { setAnswer('keep'); VBT.store.log('save', 'FTP test result ' + r.ftp + ' W not applied') }
  return (
    <div id="ftpProposal" className="ftpprop">
      <small>{r.type === 'ramp' ? 'RAMP TEST' : 'FTP TEST'} RESULT · {r.label.toUpperCase()} {r.basis} W</small>
      <b>NEW FTP {r.ftp} W</b>
      <span>was {cur} W ({diff > 0 ? '+' : ''}{diff})</span>
      <div className="finishbtns">
        <button id="ftpAccept" className="ridebtn" onClick={() => { VBT.ftp.setFtp(r.ftp, ride.name); setAnswer('accept') }}>ACCEPT {r.ftp} W</button>
        <button id="ftpKeep" className="ghostbtn" onClick={keep}>KEEP {cur} W</button>
      </div>
    </div>
  )
}

export default function FinishScreen() {
  const s = useVbt()
  useStrava()
  const [, redraw] = useState(0)
  const finished = s.state === 'finished'
  const ride = finished ? window.VBT.game.lastRide : null
  // feedback die gegeven is voordat de rit op de server stond, alsnog versturen
  useEffect(() => { if (ride && ride.serverId) flushFeedback(ride) }, [ride, ride?.serverId])
  // toetsen 1-9 en 0 (= 10) geven de RPE
  useEffect(() => {
    if (!ride) return
    const onKey = e => {
      if (!/^Digit\d$/.test(e.code) || e.target.closest?.('.vbt-panel') || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const n = +e.code.slice(5)
      saveFeedback(ride, { rpe: n === 0 ? 10 : n })
      redraw(x => x + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ride])
  if (!finished) return null
  if (!ride) return null
  const info = window.VBT.game.finishInfo || { heading: 'RIDE COMPLETE', sub: (ride.name || '').toUpperCase() }
  const st = buttonLabel(ride)
  const stat = (v, l) => <div key={l}><b>{v}</b><small>{l}</small></div>
  return (
    <div id="finish">
      <h2 id="finishTitle">{info.heading}</h2>
      <div id="finishName">{info.sub}</div>
      <div id="finishStats">
        {stat(fmtDur(ride.duration), 'TIME')}{stat((ride.distance / 1000).toFixed(1), 'KM')}{stat(ride.avgW, 'AVG W')}
        {stat(ride.kj, 'KJ')}{stat(ride.elevation, 'M UP')}
        {ride.score !== undefined && ride.score !== null && stat(ride.score + '%', 'CADENCE')}
        {ride.lapTime ? stat(fmtDur(ride.lapTime), ride.kind === 'climb' ? 'TO THE TOP' : 'BEST LAP') : null}
      </div>
      <Feedback key={'fb' + ride.clientId} ride={ride} />
      <FtpProposal key={ride.clientId} ride={ride} />
      <div className="finishbtns">
        <button id="btnFit" className="ghostbtn" onClick={() => actions().downloadFit(ride)}>&#11015; DOWNLOAD .FIT <em>D</em></button>
        <button id="btnStrava" className="ghostbtn" disabled={!st.enabled} onClick={() => rideButton(ride)}>
          &#8679; {st.text}{st.note && <em>{st.note}</em>}
        </button>
        <button id="btnFinishRides" className="ghostbtn" onClick={() => actions().openRides()}>&#9776; MY RIDES</button>
        <button id="btnDone" className="ridebtn" onClick={() => actions().finishDone()}>CONTINUE &#9654;</button>
      </div>
      <div className="hint">Ride saved - you can always find it under MY RIDES.</div>
    </div>
  )
}
