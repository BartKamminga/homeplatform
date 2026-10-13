// Canvas-grafiek in React: tekent met een gewone teken-functie (draw(ctx, w, h)), scherp op hi-dpi.
// Wordt bij elke render opnieuw getekend; houd draw goedkoop (snapshot ververst max. 10x/s).
import { useEffect, useRef } from 'react'

export default function CanvasChart({ draw, height = 80, className = '', onClick, title, id }) {
  const ref = useRef(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth, h = c.clientHeight
    if (!w || !h) return
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
  })

  const click = onClick && (e => {
    const r = e.currentTarget.getBoundingClientRect()
    onClick((e.clientX - r.left) / r.width)
  })

  return <canvas ref={ref} id={id} className={'vbt-chart ' + className} style={{ height }} onClick={click} title={title} />
}
