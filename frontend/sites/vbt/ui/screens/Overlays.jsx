// Schermen boven de weg: titel (attract mode), aftellen, pauze, stopvraag en de CRT-scanlines.
// Zichtbaarheid regelt de CSS via body[data-state] (useBodyState); deze componenten leveren de inhoud.
import { useVbt, actions } from '../hooks/useVbt.js'
import { fmtDur } from '../common/format.js'

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
  const s = useVbt()
  const p = s.pauseText || { title: 'PAUSED', sub: '' }
  return (
    <div id="paused">
      <b id="pausedTitle">{p.title}</b><small id="pausedSub">{p.sub}</small>
      <div className="pausedbtns">
        {!s.autoPaused && <button id="btnPausedResume" className="ghostbtn" onClick={e => { e.currentTarget.blur(); actions().resume() }}>&#9654; RESUME <em>SPACE</em></button>}
        <button id="btnPausedEnd" className="ridebtn danger" onClick={e => { e.currentTarget.blur(); actions().stop() }}>&#9632; END RIDE <em>ESC</em></button>
      </div>
    </div>
  )
}

// Stopvraag: wat je afsluit (tijd, afstand, wat er van de workout over is) en wat er met de rit gebeurt
export function ConfirmStop() {
  const s = useVbt()
  const run = s.run && !s.run.free ? s.run : null
  const left = run && run.total ? run.total - run.elapsed : 0
  return (
    <div id="confirm">
      <div className="confirmbox">
        <h2>END RIDE?</h2>
        <div className="confirmsum">
          <b>{fmtDur(s.rideTime)}</b><span>{(s.dist / 1000).toFixed(2)} KM</span>
          {run && <span>{run.name.toUpperCase()}{left > 1 ? ' · ' + fmtDur(left) + ' LEFT' : ''}</span>}
        </div>
        <p id="confirmSub">{left > 1 ? 'The workout is not finished yet. ' : ''}Your ride is saved under MY RIDES - you can continue it later.</p>
        <div className="confirmbtns">
          <button id="btnKeepRiding" className="ghostbtn" onClick={() => actions().cancelStop()}>&#9654; KEEP RIDING <em>ESC</em></button>
          <button id="btnStopRide" className="ridebtn danger" onClick={() => actions().confirmStop()}>&#9632; STOP &amp; SAVE <em>ENTER</em></button>
        </div>
      </div>
    </div>
  )
}

export const Crt = () => <div className="crt" />
