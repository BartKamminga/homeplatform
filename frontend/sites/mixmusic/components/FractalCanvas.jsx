import { useEffect, useRef } from 'react'

// Ambient (niet audio-reactief) fractal-achtergrond voor het uitgeklapte
// "nu speelt"-scherm (item 908). Bewust géén Web Audio/AnalyserNode-koppeling
// (platform heeft dat nergens) - dit is fase 1: een rustig meebewegende
// achtergrond op basis van tijd + afspeelstatus. Audio-reactief (op de beat)
// kan later als vervolg bovenop deze basis.
// Depth/symmetry bewust bescheiden gehouden (511 lijnen/boom * 5 = ~2500
// strokes/frame) - elke ctx.stroke() is een aparte draw-call, dieper/meer
// symmetrie loopt op mobiel al snel richting gestotter.
const MAX_DEPTH = 8
const SYMMETRY = 5

function drawBranch(ctx, x, y, len, angle, depth, spread, hue) {
  if (depth <= 0 || len < 1.5) return
  const x2 = x + Math.cos(angle) * len
  const y2 = y + Math.sin(angle) * len
  ctx.strokeStyle = `hsla(${(hue + depth * 14) % 360}, 85%, 65%, ${0.12 + (depth / MAX_DEPTH) * 0.45})`
  ctx.lineWidth = Math.max(0.6, depth * 0.55)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const next = len * 0.74
  drawBranch(ctx, x2, y2, next, angle - spread, depth - 1, spread, hue)
  drawBranch(ctx, x2, y2, next, angle + spread, depth - 1, spread, hue)
}

export default function FractalCanvas({ playing }) {
  const canvasRef = useRef(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = null
    let w = 0, h = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const start = performance.now()
    function frame(now) {
      const t = (now - start) / 1000
      const speed = playingRef.current ? 1 : 0.35
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h * 0.62
      const baseLen = Math.min(w, h) * 0.16
      const sway = Math.sin(t * 0.6 * speed) * 0.5
      const spread = 0.52 + Math.sin(t * 0.3 * speed) * 0.14
      const hue = (t * 12 * speed) % 360
      for (let i = 0; i < SYMMETRY; i++) {
        const rot = (i / SYMMETRY) * Math.PI * 2 + sway * 0.2
        drawBranch(ctx, cx, cy, baseLen, -Math.PI / 2 + rot, MAX_DEPTH, spread, hue + i * (360 / SYMMETRY))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
