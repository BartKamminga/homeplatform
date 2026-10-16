// PROGRESS: aerobe trend per week (item 1351) - gemiddelde EF (W per hartslag) en watt bij vaste hartslag,
// over ritten van 30+ min met hartslag (ride.hrMetrics, door de server berekend). Stijgend = fitter.
import CanvasChart from '../../common/CanvasChart.jsx'
import { mondayOf } from '../../common/format.js'
import { refHr, wattsAtHr } from '../rides/hrMetrics.js'

const EF_COLOR = '#24e8ff', W_COLOR = '#ffe66d'

function line(ctx, W, H, weeks, key, color) {
  const vals = weeks.map(w => w[key]).filter(v => v !== null)
  if (!vals.length) return
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.15 || hi * 0.05 || 1
  const bw = W / weeks.length
  const x = i => i * bw + bw / 2, y = v => 8 + (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * (H - 26)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  let started = false
  weeks.forEach((w, i) => {
    if (w[key] === null) return
    if (started) ctx.lineTo(x(i), y(w[key])); else { ctx.moveTo(x(i), y(w[key])); started = true }
  })
  ctx.stroke()
  weeks.forEach((w, i) => { if (w[key] !== null) { ctx.beginPath(); ctx.arc(x(i), y(w[key]), 3, 0, Math.PI * 2); ctx.fill() } })
}

function draw(ctx, W, H, weeks) {
  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.font = '8px Orbitron, sans-serif'
  const bw = W / weeks.length
  weeks.forEach((w, i) => ctx.fillText(w.label, i * bw + 3, H - 3))
  line(ctx, W, H, weeks, 'w', W_COLOR)
  line(ctx, W, H, weeks, 'ef', EF_COLOR)
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

export default function AerobicTrend({ rides, weeks }) {
  if (!rides) return null
  const hr = refHr()
  const per = weeks.map(w => {
    const rs = rides.filter(r => r.hrMetrics?.eligible && mondayOf(new Date(r.startedAt)).getTime() === w.start)
    const ef = mean(rs.map(r => r.hrMetrics.ef)), ws = rs.map(r => wattsAtHr(r.hrMetrics, hr)).filter(v => v !== null)
    return { label: w.label, n: rs.length, ef: ef === null ? null : Math.round(ef * 100) / 100, w: ws.length ? Math.round(mean(ws)) : null }
  })
  const withData = per.filter(w => w.ef !== null)
  const first = withData[0], last = withData.at(-1)
  const delta = (a, b, d = 0) => { const v = +(b - a).toFixed(d); return (v > 0 ? '+' : '') + v }
  const wFirst = per.find(w => w.w !== null), wLast = [...per].reverse().find(w => w.w !== null)

  return (
    <>
      <h4>AEROBIC FITNESS · <span style={{ color: EF_COLOR }}>EF</span> · <span style={{ color: W_COLOR }}>W @ {hr} BPM</span></h4>
      {!withData.length ? (
        <p className="pn-hint">Ride 30 minutes or more with your heart-rate strap to see how much power you deliver per heartbeat.</p>
      ) : (
        <>
          <CanvasChart height={110} draw={(ctx, w, h) => draw(ctx, w, h, per)} />
          <p className="pn-hint">
            Latest week: EF <b>{last.ef.toFixed(2)}</b>{withData.length > 1 && <> ({delta(first.ef, last.ef, 2)} since {first.label})</>}
            {wLast && <> · <b>{wLast.w} W</b> at {hr} bpm{wFirst !== wLast && <> ({delta(wFirst.w, wLast.w)} W)</>}</>}.
            Rising = more power for the same heart rate. Heart rate varies with heat, sleep and fatigue - look at the trend, not one ride.
          </p>
        </>
      )}
    </>
  )
}
