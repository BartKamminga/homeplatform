import { useEffect, useRef } from 'react'

// Synthwave-zon op canvas (item 1339), vervangt de fractal. grid=true tekent het VBT-raster; bij playing
// schuift het raster mee (alleen met grid, en niet bij prefers-reduced-motion).
function draw(cv, grid, phase) {
  const ctx = cv.getContext('2d')
  const w = cv.width, h = cv.height, hz = grid ? h * 0.62 : h * 0.7
  const sky = ctx.createLinearGradient(0, 0, 0, hz)
  sky.addColorStop(0, '#07011a'); sky.addColorStop(0.6, '#2a0750'); sky.addColorStop(1, '#b0157a')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h)
  const r = w * 0.3, cx = w / 2, cy = hz - r * 0.15
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r)
  sun.addColorStop(0, '#ffe66d'); sun.addColorStop(1, '#ff2e88')
  ctx.save(); ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = w * 0.08; ctx.fillStyle = sun
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.fillStyle = '#2a0750'
  for (let i = 0; i < 6; i++) ctx.fillRect(cx - r, cy + r * (0.1 + i * 0.16), r * 2, Math.max(1, r * (0.03 + i * 0.018)))
  ctx.fillStyle = '#07011a'; ctx.fillRect(0, hz, w, h - hz)
  ctx.strokeStyle = '#ff2ef0'; ctx.lineWidth = Math.max(1, w / 300); ctx.shadowColor = '#ff2ef0'; ctx.shadowBlur = 6
  ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(w, hz); ctx.stroke()
  if (!grid) { ctx.shadowBlur = 0; return }
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(cx + i * w * 0.04, hz); ctx.lineTo(cx + i * w * 0.32, h); ctx.stroke() }
  for (let j = 0; j < 9; j++) {
    const t = (j + phase) / 8
    if (t <= 0 || t > 1) continue
    const y = hz + (h - hz) * t * t
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  ctx.shadowBlur = 0
}

export default function SynthSun({ grid = false, playing = false, className, width = 192, height = 192 }) {
  const ref = useRef(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!grid || !playing || reduce) { draw(cv, grid, 0); return }
    let raf, phase = 0, last = performance.now()
    const tick = now => {
      phase = (phase + (now - last) / 1200) % 1
      last = now
      draw(cv, grid, phase)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [grid, playing])

  return <canvas ref={ref} className={className} width={width} height={height} aria-hidden="true" />
}
