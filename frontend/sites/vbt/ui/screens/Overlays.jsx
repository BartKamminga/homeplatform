// Schermen boven de weg: titel (attract mode), aftellen, pauze, stopvraag en de CRT-scanlines.
// Zichtbaarheid regelt de CSS via body[data-state] (useBodyState); deze componenten leveren de inhoud.
import { useVbt, actions } from '../hooks/useVbt.js'

export function TitleScreen() {
  const a = () => actions()
  return (
    <div id="title">
      <div className="logo"><span className="v">V</span><span className="b">B</span><span className="t">T</span></div>
      <div className="tagline">VIRTUAL&nbsp;BIKE&nbsp;TRAINER</div>
      <div className="press">PRESS SPACE TO START</div>
      <div className="menu">
        <div className="menubtns">
          <button id="btnFree" onClick={() => a().startFreeRide()}>&#9654; FREE RIDE <em>SPACE</em></button>
          <button id="btnPlan" onClick={() => a().openPlan()}>&#9638; MY PLAN <em>T</em></button>
          <button id="btnRides" onClick={() => a().openRides()}>&#9776; MY RIDES <em>R</em></button>
          <button id="btnHelp" onClick={() => window.VBT.ui?.open('left', 'help')}>? HELP <em>H</em></button>
          <button id="btnDevices" onClick={() => window.VBT.ui?.open('left', 'devices')}>&#9655; CONNECT KICKR <em>K</em></button>
        </div>
        <span>FREE RIDE: &#8593;&#8595; POWER · SHIFT SPRINT &nbsp;|&nbsp; WORKOUT (ERG): &#8593;&#8595; CADENCE &nbsp;|&nbsp; &#8592;&#8594; STEER · SPACE PAUSE · ESC END RIDE</span>
      </div>
      <div className="credit">&copy; 2026 HOMEPLATFORM ARCADE &nbsp; INSERT COIN</div>
    </div>
  )
}

export function Countdown() {
  const n = useVbt(s => (s.state === 'countdown' ? s.countdown : null), { fast: true })
  if (n === null) return <div id="countdown" />
  // nieuwe tel = nieuwe key, zodat de pop-animatie per tel opnieuw start
  return <div id="countdown" key={n} className="pop">{n > 0 ? n : 'GO!'}</div>
}

export function Paused() {
  const p = useVbt(s => s.pauseText) || { title: 'PAUSED', sub: '' }
  return <div id="paused"><b id="pausedTitle">{p.title}</b><small id="pausedSub">{p.sub}</small></div>
}

export function ConfirmStop() {
  return (
    <div id="confirm">
      <div className="confirmbox">
        <h2>STOP RIDE?</h2>
        <p id="confirmSub">Your ride is always saved - find it under MY RIDES.</p>
        <div className="confirmbtns">
          <button id="btnKeepRiding" className="ghostbtn" onClick={() => actions().cancelStop()}>NO <em>N / ESC</em></button>
          <button id="btnStopRide" className="ridebtn" onClick={() => actions().confirmStop()}>YES <em>Y / ENTER</em></button>
        </div>
      </div>
    </div>
  )
}

export const Crt = () => <div className="crt" />
