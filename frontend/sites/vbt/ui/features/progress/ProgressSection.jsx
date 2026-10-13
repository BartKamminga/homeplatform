// PROGRESS: FTP-verloop (uit settings.ftpHistory) en trainingsvolume per week (laatste 12 weken).
// De trend van vermogens- en hartslagzones over tijd volgt later (eigen roadmap-item).
import { useEffect, useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { actions, useVbtValue } from '../../hooks/useVbt.js'
import { parseIso, mondayOf } from '../../common/format.js'

const WEEKS = 12

function drawFtp(ctx, W, H, points) {
  if (points.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,.5)'
    ctx.font = '11px Orbitron, sans-serif'
    ctx.fillText('Do an FTP test to start your FTP line', 10, H / 2)
    return
  }
  const t0 = points[0].t, t1 = Math.max(points.at(-1).t, t0 + 86400000)
  const lo = Math.min(...points.map(p => p.ftp)) - 10, hi = Math.max(...points.map(p => p.ftp)) + 10
  const x = t => 8 + (t - t0) / (t1 - t0) * (W - 50), y = v => H - 14 - (v - lo) / (hi - lo) * (H - 28)
  ctx.strokeStyle = '#ffe66d'
  ctx.lineWidth = 2
  ctx.beginPath()
  points.forEach((p, i) => { if (i) { ctx.lineTo(x(p.t), y(points[i - 1].ftp)); ctx.lineTo(x(p.t), y(p.ftp)) } else ctx.moveTo(x(p.t), y(p.ftp)) })
  ctx.lineTo(W - 42, y(points.at(-1).ftp))
  ctx.stroke()
  ctx.fillStyle = '#ffe66d'
  ctx.font = '11px Orbitron, sans-serif'
  ctx.fillText(points.at(-1).ftp + ' W', W - 40, y(points.at(-1).ftp) + 4)
}

function drawWeeks(ctx, W, H, weeks) {
  const max = Math.max(60, ...weeks.map(w => w.min))
  const bw = W / weeks.length
  weeks.forEach((w, i) => {
    const h = w.min / max * (H - 18)
    ctx.fillStyle = i === weeks.length - 1 ? '#24e8ff' : 'rgba(155,92,255,.8)'
    ctx.fillRect(i * bw + 3, H - 14 - h, bw - 6, h)
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.font = '8px Orbitron, sans-serif'
    if (w.min) ctx.fillText(String(Math.round(w.min)), i * bw + 4, H - 17 - h)
    ctx.fillText(w.label, i * bw + 3, H - 3)
  })
}

export default function ProgressSection() {
  const history = useVbtValue(s => s.settings?.ftpHistory) || []
  const ftp = useVbtValue(s => s.ftp)
  const [rides, setRides] = useState(null)
  useEffect(() => {
    let alive = true
    actions().listRides().then(r => { if (alive) setRides(r) }).catch(() => { if (alive) setRides([]) })
    return () => { alive = false }
  }, [])

  const points = history.map(h => ({ t: parseIso(h.date).getTime(), ftp: h.ftp }))
  if (history.length) points.unshift({ t: points[0].t - 7 * 86400000, ftp: history[0].prev })

  const thisMonday = mondayOf(new Date())
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const m = new Date(thisMonday); m.setDate(m.getDate() - (WEEKS - 1 - i) * 7)
    return { start: m.getTime(), label: m.getDate() + '/' + (m.getMonth() + 1), min: 0, kj: 0, n: 0 }
  })
  for (const r of rides || []) {
    const w = weeks.find(x => { const t = mondayOf(new Date(r.startedAt)).getTime(); return x.start === t })
    if (w) { w.min += (r.duration || 0) / 60; w.kj += r.kj || 0; w.n++ }
  }
  const cur = weeks.at(-1)

  return (
    <div className="pn-section">
      <h4>FTP · NOW {ftp} W</h4>
      <CanvasChart height={110} draw={(ctx, w, h) => drawFtp(ctx, w, h, points)} />
      {history.length > 0 && (
        <ul className="pn-history">{history.slice().reverse().slice(0, 8).map((h, i) => (
          <li key={i}><span>{h.date}</span><b>{h.ftp} W</b><i>{h.prev ? (h.ftp - h.prev > 0 ? '+' : '') + (h.ftp - h.prev) + ' · ' : ''}{h.source}</i></li>))}</ul>
      )}
      <h4>MINUTES PER WEEK</h4>
      {rides === null ? <p className="pn-hint">Loading rides...</p> : (
        <>
          <CanvasChart height={120} draw={(ctx, w, h) => drawWeeks(ctx, w, h, weeks)} />
          <p className="pn-hint">This week: {cur.n} {cur.n === 1 ? 'ride' : 'rides'} · {Math.round(cur.min)} min · {cur.kj} kJ.
            Last {WEEKS} weeks: {weeks.reduce((a, w) => a + w.n, 0)} rides · {Math.round(weeks.reduce((a, w) => a + w.min, 0) / 60)} h.</p>
        </>
      )}
      <p className="pn-hint">Power and heart-rate zone trends over time are coming next.</p>
    </div>
  )
}
