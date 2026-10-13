// TELEMETRY: laatste 2 minuten (1 Hz) - vermogen in zonekleur, ERG-doel, hartslag en cadans - plus kerncijfers.
import CanvasChart from '../../common/CanvasChart.jsx'
import { useVbt } from '../../hooks/useVbt.js'

function avg(rows, i, n) {
  const r = rows.slice(-n).map(x => x[i]).filter(v => v !== null)
  return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : 0
}

function draw(ctx, w, h, rows) {
  if (rows.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,.45)'
    ctx.font = '12px Orbitron, sans-serif'
    ctx.fillText('Telemetry starts when you ride', 10, h / 2)
    return
  }
  const N = 120, bw = w / N
  const maxW = Math.max(200, ...rows.map(r => Math.max(r[1], r[4] || 0))) * 1.1
  const x = i => w - (rows.length - i) * bw
  rows.forEach((r, i) => {
    ctx.fillStyle = window.VBT.util.zoneFor(r[1]).color
    const bh = r[1] / maxW * h
    ctx.fillRect(x(i), h - bh, Math.max(1, bw - 0.5), bh)
  })
  const line = (idx, color, scale, dash) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.setLineDash(dash || [])
    ctx.beginPath()
    let started = false
    rows.forEach((r, i) => {
      if (r[idx] === null || r[idx] === undefined) { started = false; return }
      const y = h - r[idx] * scale
      if (started) ctx.lineTo(x(i) + bw / 2, y); else { ctx.moveTo(x(i) + bw / 2, y); started = true }
    })
    ctx.stroke()
    ctx.setLineDash([])
  }
  line(4, '#ffffff', h / maxW, [4, 3])        // ERG-doel
  line(2, '#ff2e88', h / 200)                 // hartslag
  line(3, '#24e8ff', h / 150)                 // cadans
}

export default function TelemetryTab() {
  const s = useVbt()
  const rows = window.VBT.store.getTelemetry()
  const target = s.run && s.run.target
  const dev = target && target.watts ? Math.round((s.watts - target.watts) / target.watts * 100) : null
  return (
    <div className="pn-section">
      <CanvasChart height={150} draw={(ctx, w, h) => draw(ctx, w, h, rows)} />
      <p className="pn-legend"><i className="lg-w" />power <i className="lg-t" />ERG target <i className="lg-h" />heart rate <i className="lg-c" />cadence · last 2 min</p>
      <div className="pn-grid">
        <div><small>POWER</small><b>{s.watts} W</b><i>3s {s.avg3s} · 30s {avg(rows, 1, 30)}</i></div>
        <div><small>ERG TARGET</small><b>{target ? target.watts + ' W' : '-'}</b><i>{dev === null ? 'free ride' : (dev > 0 ? '+' : '') + dev + '% off'}</i></div>
        <div><small>HEART RATE</small><b>{s.hr} BPM</b><i>30s {avg(rows, 2, 30)}</i></div>
        <div><small>CADENCE</small><b>{s.cadence} RPM</b><i>30s {avg(rows, 3, 30)}</i></div>
        <div><small>SPEED</small><b>{s.speed.toFixed(1)}</b><i>km/h</i></div>
        <div><small>GRADE</small><b>{(s.grade * 100).toFixed(1)}%</b><i>alt {Math.round(s.alt)} m</i></div>
      </div>
    </div>
  )
}
