// PROGRESS: virtuele FTP (item 1302) - continu geschat uit je ritten van de laatste 6 weken, zonder test.
// Rekenregels (beste gemiddelde vermogens per rit, door de server berekend in ride.hrMetrics.mmp):
//   60 min x 1.00  ·  20 min x 0.95 (zoals de FTP-test)  ·  8 min x 0.90 (Carmichael)
// De hoogste telt. Alleen omhoog voorstellen: een rustige rit of een ERG-workout onder je FTP zegt niets over je
// maximum, dus een lagere schatting betekent niet dat je FTP gezakt is - daarvoor doe je een test.
import { useState } from 'react'
import { useVbtValue } from '../../hooks/useVbt.js'
import { fmtDateTime } from '../../common/format.js'

const DAYS = 42
const RULES = [['3600', 1.0, '60-min best'], ['1200', 0.95, '20-min best'], ['480', 0.9, '8-min best']]

export function estimate(rides) {
  const since = Date.now() - DAYS * 86400000
  let best = null
  for (const r of rides || []) {
    const m = r.hrMetrics?.mmp
    if (!m || Date.parse(r.startedAt) < since) continue
    for (const [win, f, label] of RULES) {
      if (!m[win]) continue
      const ftp = Math.round(m[win] * f)
      if (!best || ftp > best.ftp) best = { ftp, basis: m[win], label, ride: r }
    }
  }
  return best
}

export default function VirtualFtp({ rides }) {
  const ftp = useVbtValue(s => s.ftp)
  const [done, setDone] = useState(false)
  if (!rides) return null
  const est = estimate(rides)
  const higher = est && est.ftp >= Math.round(ftp * 1.03)
  return (
    <div className="pn-vftp">
      <h4>VIRTUAL FTP</h4>
      {!est ? <p className="pn-hint">Ride 8 minutes or more to get an estimate from your rides.</p> : (
        <>
          <p className="pn-kv"><span>ESTIMATE (LAST {DAYS} DAYS)</span><b style={{ color: higher ? '#5dff9e' : undefined }}>{est.ftp} W</b></p>
          <p className="pn-hint">From your {est.label} of {est.basis} W ({(est.ride.name || 'Ride')} · {fmtDateTime(est.ride.startedAt)}).
            {higher ? ' That is more than your FTP of ' + ftp + ' W.' : ' Your FTP of ' + ftp + ' W is at least this - an easy ride does not lower it; do a test for that.'}</p>
          {higher && !done && <div className="pn-buttons">
            <button id="vftpUse" className="ridebtn" onClick={() => { window.VBT.ftp.setFtp(est.ftp, 'Virtual FTP'); setDone(true) }}>USE {est.ftp} W AS FTP</button></div>}
          {done && <p className="pn-hint">FTP set to {est.ftp} W - all workouts use it now.</p>}
        </>
      )}
    </div>
  )
}
