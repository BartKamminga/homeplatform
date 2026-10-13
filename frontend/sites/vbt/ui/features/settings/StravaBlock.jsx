// STRAVA in SETTINGS: status van jouw koppeling, koppelen (komt terug in VBT) en beheren in Mijn account
import { useEffect, useState } from 'react'

export default function StravaBlock() {
  const [st, setSt] = useState(null)
  useEffect(() => {
    let alive = true
    window.VBT.strava?.status().then(s => { if (alive) setSt(s) }).catch(() => { if (alive) setSt({ configured: false }) })
    return () => { alive = false }
  }, [])
  if (!window.VBT.strava || !st) return null

  const connect = async () => {
    try { window.location.href = await window.VBT.strava.connectUrl() } catch (e) { window.VBT.toast?.(e.message, 6000) }
  }
  return (
    <>
      <h4>STRAVA</h4>
      <div id="stravaStatus" className="pn-kv">
        <span>{!st.configured ? 'NOT SET UP ON THIS SERVER' : st.connected ? (st.athleteName || 'CONNECTED').toUpperCase() : 'NOT CONNECTED'}</span>
        <b className="pn-status" data-status={st.connected ? 'ok' : 'off'}>{st.connected ? '✓' : '-'}</b>
      </div>
      <p className="pn-hint">{st.connected
        ? 'Rides can be uploaded from the finish screen (STRAVA button).'
        : 'Connect your own Strava account to upload rides from the finish screen.'}</p>
      <div className="pn-buttons">
        {st.configured && !st.connected && <button className="ghostbtn strava" onClick={connect}>&#8679; CONNECT STRAVA</button>}
        <a className="ghostbtn" href="/account/profile" target="_blank" rel="noopener noreferrer">MANAGE IN MY ACCOUNT &#8599;</a>
      </div>
    </>
  )
}
