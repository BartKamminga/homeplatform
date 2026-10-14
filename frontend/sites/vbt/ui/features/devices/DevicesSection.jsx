// DEVICES: KICKR en hartslagband koppelen, live waarden, ERG-test. Het volledige Bluetooth-log staat
// in het live-paneel (tab BLUETOOTH).
import { useState } from 'react'
import { useVbt, actions } from '../../hooks/useVbt.js'

const LABEL = { idle: 'NOT CONNECTED', connecting: 'CONNECTING…', reconnecting: 'RECONNECTING…', connected: 'CONNECTED' }

// Chrome ziet het apparaat niet (meer): na 3x 'no longer in range' of een lege keuzelijst deze tips tonen
function NotFoundTips({ kind }) {
  return (
    <div id={'tips-' + kind} className="pn-tips">
      <b>{kind === 'trainer' ? 'KICKR NOT FOUND?' : 'STRAP NOT FOUND?'}</b>
      {kind === 'trainer' ? (
        <ol>
          <li><b>Wake the KICKR</b>: pedal a few strokes until the light blinks blue - it sleeps after a while.</li>
          <li><b>Free it</b>: close Zwift / the Wahoo app (phone, tablet) and any other VBT tab - a connected KICKR stops advertising.</li>
          <li><b>Windows Bluetooth</b>: switch it off and on, or restart Chrome. Paired in Windows settings? Remove it there.</li>
          <li>Test: open <code>chrome://bluetooth-internals/#devices</code> and press <i>Start scan</i> - is KICKR CORE listed?</li>
        </ol>
      ) : (
        <ol><li>Wear the strap (it needs skin contact, moisten the pads) and close other apps using it.</li>
          <li>Still nothing? Switch Windows Bluetooth off and on.</li></ol>
      )}
    </div>
  )
}

function DeviceRow({ kind, link, value }) {
  const [cancelled, setCancelled] = useState(false)
  const choose = async () => {
    try { await actions().connect(kind); setCancelled(false) } catch (e) {
      window.VBT.ble.note(kind + ': ' + e.message)
      if (/cancel/i.test(e.message)) setCancelled(true)     // keuzelijst leeg/gesloten: apparaat niet gezien
    }
  }
  const toggle = () => (link.wanted ? actions().disconnect(kind) : choose())
  // blijft hij hangen (bv. onthouden apparaat na herladen), dan direct opnieuw kunnen kiezen zonder eerst te ontkoppelen
  const stuck = link.wanted && link.status !== 'connected' && link.retries >= 1
  const lost = link.wanted && link.status !== 'connected' && link.retries >= 3 && /range|not found|unavailable|network/i.test(link.lastError)
  return (
    <div className="pn-device">
      <div>
        <small>{kind === 'trainer' ? 'TRAINER' : 'HEART RATE'}</small>
        <b>{link.wanted ? link.name + (link.protocol ? ' · ' + link.protocol : '') : kind === 'trainer' ? 'Wahoo KICKR (FTMS)' : 'Heart rate strap'}</b>
        <span className="pn-live">{value}</span>
      </div>
      <span className="devstatus" data-status={link.status}>{LABEL[link.status] || link.status}</span>
      <span className="pn-devbtns">
        {stuck && <button className="ridebtn" onClick={choose}>CHOOSE AGAIN</button>}
        <button className={stuck ? 'ghostbtn' : 'ridebtn'} onClick={toggle}>{link.wanted ? (stuck ? 'STOP' : 'DISCONNECT') : 'CONNECT'}</button>
      </span>
      {(lost || (cancelled && !link.wanted)) && <NotFoundTips kind={kind} />}
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
