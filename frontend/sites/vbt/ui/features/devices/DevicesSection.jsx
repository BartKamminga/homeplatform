// DEVICES: KICKR en hartslagband koppelen, live waarden, ERG-test. Het volledige Bluetooth-log staat
// in het live-paneel (tab BLUETOOTH).
import { useState } from 'react'
import { useVbt, actions } from '../../hooks/useVbt.js'

const LABEL = { idle: 'NOT CONNECTED', connecting: 'CONNECTING…', reconnecting: 'RECONNECTING…', connected: 'CONNECTED' }

function DeviceRow({ kind, link, value, onLog }) {
  const toggle = async () => {
    if (link.wanted) { actions().disconnect(kind); return }
    try { await actions().connect(kind) } catch (e) { window.VBT.ble.note(kind + ': ' + e.message) }
  }
  return (
    <div className="pn-device">
      <div>
        <small>{kind === 'trainer' ? 'TRAINER' : 'HEART RATE'}</small>
        <b>{link.wanted ? link.name + (link.protocol ? ' · ' + link.protocol : '') : kind === 'trainer' ? 'Wahoo KICKR (FTMS)' : 'Heart rate strap'}</b>
        <span className="pn-live">{value}</span>
      </div>
      <span className="devstatus" data-status={link.status}>{LABEL[link.status] || link.status}</span>
      <button className="ridebtn" onClick={toggle}>{link.wanted ? 'DISCONNECT' : 'CONNECT'}</button>
    </div>
  )
}

export default function DevicesSection({ onShowLog, onHelp }) {
  const ble = useVbt(s => s.ble)
  const [erg, setErg] = useState(false)
  if (!ble) return null
  const L = ble.live
  const toggleErg = () => { actions().ergTest(erg ? 0 : 100); setErg(!erg) }

  return (
    <div className="pn-section">
      <DeviceRow kind="trainer" link={ble.trainer}
        value={ble.trainerOk ? `${L.power} W · ${L.cadence} RPM · ${L.speed.toFixed(1)} KM/H` : '-'} />
      <DeviceRow kind="hr" link={ble.hr} value={ble.hrOk ? `${L.hr} BPM` : '-'} />
      <div className="pn-buttons">
        <button className="ghostbtn" disabled={!ble.ergCapable} onClick={toggleErg}>{erg ? 'STOP ERG TEST' : 'ERG TEST 100 W'}</button>
        <button className="ghostbtn" onClick={onShowLog}>BLUETOOTH LOG &#9656;</button>
        <button className="ghostbtn" onClick={onHelp}>? HELP</button>
      </div>
      <p className="pn-hint">Chrome or Edge · Bluetooth on · close the Wahoo app and Zwift so the KICKR is free.</p>
    </div>
  )
}
