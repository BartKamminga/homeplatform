// PROGRESS: tijd in vermogens- of hartslagzones per week (item 1297), als gestapelde staafjes in de zonekleuren.
// Vermogen: per rit t.o.v. de FTP van die rit (server, ride.hrMetrics.zones.pw). Hartslag: histogram per 5 bpm,
// hier omgerekend met de hrMax van nu. Onderaan de verdeling laag / midden / hoog over de getoonde weken.
import { useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { mondayOf } from '../../common/format.js'

function hrZoneSeconds(hist, hrMax) {
  const zs = window.VBT.hrZones, out = zs.map(() => 0)
  for (const [b, sec] of Object.entries(hist || {})) {
    const f = (+b + 2.5) / hrMax
    const i = zs.findIndex(z => f <= z.max)
    out[i < 0 ? zs.length - 1 : i] += sec
  }
  return out
}

function draw(ctx, W, H, weeks, zones) {
  const max = Math.max(30, ...weeks.map(w => w.sec.reduce((a, b) => a + b, 0) / 60))
  const bw = W / weeks.length
  ctx.font = '8px Orbitron, sans-serif'
  weeks.forEach((w, i) => {
    let y = H - 14
    w.sec.forEach((sec, z) => {
      const h = sec / 60 / max * (H - 24)
      if (h <= 0) return
      ctx.fillStyle = zones[z].color
      ctx.fillRect(i * bw + 3, y - h, bw - 6, h)
      y -= h
    })
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.fillText(w.label, i * bw + 3, H - 3)
  })
}

export default function ZoneTrend({ rides, weeks }) {
  const [kind, setKind] = useState('power')
  if (!rides) return null
  const VBT = window.VBT
  const zones = kind === 'power' ? VBT.zones : VBT.hrZones
  const hrMax = VBT.settings.values.hrMax || 185
  const per = weeks.map(w => {
    const sec = zones.map(() => 0)
    for (const r of rides) {
      const z = r.hrMetrics?.zones
      if (!z || mondayOf(new Date(r.startedAt)).getTime() !== w.start) continue
      const s = kind === 'power' ? z.pw : hrZoneSeconds(z.hr, hrMax)
      s.forEach((v, i) => { sec[i] += v || 0 })
    }
    return { label: w.label, sec }
  })
  const total = zones.map((_, i) => per.reduce((a, w) => a + w.sec[i], 0))
  const all = total.reduce((a, b) => a + b, 0)
  // laag = Z1-Z2, midden = Z3-Z4 (vermogen) / Z3 (hartslag), hoog = de rest
  const lowN = 2, midN = kind === 'power' ? 2 : 1
  const pct = (a, b) => Math.round(total.slice(a, b).reduce((x, y) => x + y, 0) / all * 100)

  return (
    <>
      <h4 className="pn-headrow">TIME IN ZONES PER WEEK
        <span className="pn-viewtoggle">
          <button className={kind === 'power' ? 'active' : ''} onClick={() => setKind('power')}>POWER</button>
          <button className={kind === 'hr' ? 'active' : ''} onClick={() => setKind('hr')}>HEART RATE</button>
        </span>
      </h4>
      {!all ? <p className="pn-hint">No zone data yet - it fills up as you ride.</p> : (
        <>
          <CanvasChart height={120} draw={(ctx, w, h) => draw(ctx, w, h, per, zones)} />
          <div className="pn-legend zones">{zones.map((z, i) => (
            <span key={z.name}><i style={{ background: z.color }} />{z.name} {Math.round(total[i] / all * 100)}%</span>))}</div>
          <p className="pn-hint">Last {weeks.length} weeks: easy (Z1-Z2) {pct(0, lowN)}% · middle ({kind === 'power' ? 'Z3-Z4' : 'Z3'}) {pct(lowN, lowN + midN)}% ·
            hard {pct(lowN + midN, zones.length)}%. Most riders get fitter with lots of easy riding and a little hard work - and not too much in the middle.</p>
        </>
      )}
    </>
  )
}
