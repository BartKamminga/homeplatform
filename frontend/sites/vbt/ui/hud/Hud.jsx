// HUD tijdens de rit: vermogen, hartslag, ronde/afstand, tijd/ghost/peloton/backup, snelheid, hoogteprofiel,
// workout-paneel, ploegleider en pop-up-meldingen. Leest het snelle snapshot (10x/s); ids/klassen zoals voorheen,
// zodat de CSS en de weergave-instellingen (body.off-*) gewoon werken.
import { useEffect, useRef } from 'react'
import CanvasChart from '../common/CanvasChart.jsx'
import { useVbt, actions } from '../hooks/useVbt.js'
import MusicBar from '../features/music/MusicBar.jsx'

const ZoneBar = ({ id, zones, frac, needleId }) => (
  <div id={id} className="zonebar">
    {zones.map(z => <div key={z.name} style={{ background: z.color }} />)}
    <span id={needleId} style={{ left: frac * 100 + '%' }} />
  </div>
)

function Chip({ id, status, title, children }) {
  if (!status) return null
  return <span id={id} className="devchip" data-status={status} title={title}>{children}</span>
}

// hoogteprofiel: eigen canvas (vaste resolutie zoals voorheen), elke snapshot opnieuw getekend
function Profile() {
  const ref = useRef(null)
  useVbt(null, { fast: true })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    window.VBT.hud.drawProfile(ctx, c.width, c.height, window.VBT.game)
  })
  return <canvas id="profile" ref={ref} width="340" height="96" />
}

function WorkoutPanel({ w }) {
  const VBT = window.VBT
  const wo = VBT.game.run?.wo
  return (
    <section className="panel wpanel">
      <div className="wtop"><span id="wName">{w.name}</span><span id="wScore">CADENCE {w.score}%</span><span id="wLeft">{w.left}</span></div>
      <div className="wtarget">
        <span className="big"><span id="wWatts">{w.watts}</span><small>W</small></span>
        <span className="wmid"><span id="wPct">{w.pct}</span><span id="wCad" className={'wcad' + (w.cadOff ? ' off' : '')}>{w.cad}</span></span>
        <span className="wremain" id="wRemain">{w.remain}</span>
      </div>
      <div className="wnext" id="wNext">{w.next}</div>
      {wo && <CanvasChart id="wChart" height={64} title={w.free ? undefined : 'Click an interval to jump there'}
        draw={(ctx, cw, ch) => VBT.workout.drawChart(ctx, wo, cw, ch, w.progress)}
        onClick={w.free ? undefined : frac => { if (VBT.game.state === 'ride') actions().jumpTo(actions().stepAt(wo, frac)) }} />}
    </section>
  )
}

// Autopilot: geen Kickr, de game fietst zelf - speels in beeld (en zo'n rit wordt niet bewaard)
function SimBadge({ sim }) {
  if (!sim) return null
  return (
    <div id="simBadge" title="No trainer connected - the game is riding for you. This ride will not be saved.">
      <span className="bot">&#129302;</span>
      <span className="txt"><b>AUTOPILOT</b><i key={sim.quip}>{sim.quip}</i></span>
      <span className="stamp">NOT SAVED</span>
    </div>
  )
}

function Message({ msg }) {
  // nieuwe melding = nieuwe key, zodat de pop-animatie opnieuw start
  return <div id="message" key={msg ? msg.seq : 0} className={msg ? 'pop' : ''} style={{ color: msg?.color || undefined }}>{msg?.text}</div>
}

export default function Hud() {
  const s = useVbt(null, { fast: true })
  const h = s.hud
  if (!h) return null
  const VBT = window.VBT
  const grade = h.grade
  return (
    <div id="hud">
      <section className="panel power">
        <label>POWER <span id="zoneName" className="chip" style={{ background: h.zoneColor }}>{h.zone}</span>
          <Chip id="chipTrainer" status={h.chips.trainer}>KICKR</Chip><Chip id="chipHr" status={h.chips.hr}>&#9829; HR</Chip>
          <Chip id="chipBackup" status={h.chips.backup} title={h.chips.backupTitle}>&#9729; BACKUP</Chip></label>
        <div className="big"><span id="watts" style={{ color: h.zoneColor, textShadow: '0 0 18px ' + h.zoneColor }}>{h.watts}</span><small>W</small></div>
        <ZoneBar id="zoneBar" zones={VBT.zones} frac={h.powerFrac} needleId="zoneNeedle" />
        <div className="sub">3S AVG <b id="avg">{h.avg3s}</b> W · FTP <span id="ftpLabel">{h.ftp}</span></div>
      </section>

      <section className="panel heartpanel">
        <label>HEART RATE <span id="hrZoneName" className="chip" style={{ background: h.hrColor }}>{h.hrZone}</span></label>
        <div className="big"><span id="hrBig" style={{ color: h.hrColor, textShadow: '0 0 18px ' + h.hrColor }}>{h.hr}</span><small>BPM</small></div>
        <ZoneBar id="hrZoneBar" zones={VBT.hrZones} frac={h.hrFrac} needleId="hrNeedle" />
        <div className="sub">30S AVG <b id="hrAvg">{h.hrAvg}</b> · <span id="hrZoneLabel">{h.hrLabel}</span> · MAX <span id="hrMaxLabel">{h.hrMax}</span></div>
      </section>

      <section className="panel center">
        <div className="logo-mini">VBT</div>
        <div className="row"><span id="lap">LAP {h.lap}</span><span className="sep">·</span><span><b id="dist">{h.km}</b> KM</span></div>
      </section>

      <section className="panel right">
        <label>TIME</label>
        <div className="mid" id="time">{h.time}</div>
        <label id="gapLabel">{h.gapM > 0 ? h.ghostLabel + ' +' + Math.round(h.gapM) + ' M' : 'YOU LEAD ' + h.ghostLabel + ' +' + Math.round(-h.gapM) + ' M'}</label>
        <div className={'mid ' + (h.gapM > 0 ? 'behind' : 'ahead')} id="gap">{(h.gapM > 0 ? '-' : '+') + h.gapS.toFixed(1)}s</div>
        <label id="bunchLabel">{h.inBunch ? 'IN THE BUNCH' : h.packGap > 0 ? 'BUNCH AHEAD' : 'BUNCH BEHIND'}</label>
        <div className={'mid ' + (h.inBunch || h.packGap <= 0 ? 'ahead' : 'behind')} id="bunch">{h.inBunch ? h.bunchSaved + ' W SAVED' : Math.round(Math.abs(h.packGap)) + ' M'}</div>
        {h.backup && <><label id="backupLabel">SERVER BACKUP</label><div className={'mid ' + h.backup.cls} id="backup">{h.backup.text}</div></>}
        {['ride', 'paused'].includes(s.state) && <button id="hudStop" className="ghostbtn danger" onClick={e => { e.currentTarget.blur(); actions().stop() }}>&#9632; END RIDE <em>ESC</em></button>}
      </section>

      <section className="panel speedo">
        <label>SPEED</label>
        <div className="big"><span id="speed">{h.kmh.toFixed(1)}</span><small>KM/H</small></div>
        <div id="speedBar" className="leds">{Array.from({ length: 24 }, (_, i) => <i key={i} className={i < h.speedLeds ? 'on' : ''} />)}</div>
        <div className="row metrics">
          <span><b id="cadence">{h.cadence}</b> RPM</span>
          <span><i id="heart" className="heart" style={{ animationDuration: 60 / Math.max(40, h.hr) + 's' }}>&#9829;</i> <b id="hr">{h.hr}</b> BPM</span>
        </div>
      </section>

      <section className="panel elev">
        <label>ELEVATION <span id="alt" className="alt">ALT {h.alt} M</span> <span id="grade" className={grade > 4 ? 'steep' : grade < -2 ? 'down' : ''}>{(grade >= 0 ? '+' : '') + grade.toFixed(1)}%</span></label>
        <Profile />
      </section>

      {s.workout && <WorkoutPanel w={s.workout} />}

      <div id="coach" className={s.coach?.show ? 'show' : ''}><b>&#128227; TEAM DIRECTOR</b><span id="coachText">{s.coach?.text}</span></div>
      <SimBadge sim={h.sim} />
      <Message msg={s.message} />
      <div id="draftFx" />
      <MusicBar />
    </div>
  )
}
