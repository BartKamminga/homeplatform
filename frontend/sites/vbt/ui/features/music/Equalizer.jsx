// Arcade-equalizer in de muziekbalk (item 1359): 16 staafjes uit LED-blokjes met vallende piekjes,
// kleur van blauw (laag) via groen/geel naar roze (hoog). Leest de Web Audio-analyser; tekent alleen als er muziek speelt.
import { useEffect, useRef } from 'react'
import { getAnalyser } from './music.js'

const BARS = 16, LEDS = 8, W = 112, H = 26
const COLORS = ['#3d8bff', '#3d8bff', '#24e8ff', '#2bd67b', '#2bd67b', '#ffe66d', '#ff9e3d', '#ff2e88']

export default function Equalizer({ playing }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !playing) return
    const g = c.getContext('2d')
    const data = new Uint8Array(32)
    const peaks = new Array(BARS).fill(0)
    const bw = W / BARS, lh = H / LEDS
    let raf
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const a = getAnalyser()
      g.clearRect(0, 0, W, H)
      if (!a) return
      a.getByteFrequencyData(data)
      for (let i = 0; i < BARS; i++) {
        // lage tonen krijgen meer bins dan hoge (oor-achtig), max per staaf
        const from = Math.floor(Math.pow(i / BARS, 1.6) * 28), to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / BARS, 1.6) * 28))
        let v = 0
        for (let j = from; j < to; j++) v = Math.max(v, data[j])
        const n = Math.round(v / 255 * LEDS)
        peaks[i] = Math.max(n, peaks[i] - 0.08)
        for (let l = 0; l < n; l++) {
          g.fillStyle = COLORS[l]
          g.fillRect(i * bw + 1, H - (l + 1) * lh + 1, bw - 2, lh - 1.5)
        }
        const p = Math.round(peaks[i])
        if (p > 0) { g.fillStyle = '#fff'; g.fillRect(i * bw + 1, H - p * lh, bw - 2, 1.5) }
      }
    }
    draw()
    return () => { cancelAnimationFrame(raf); g.clearRect(0, 0, W, H) }
  }, [playing])
  return <canvas className="eq" ref={ref} width={W} height={H} aria-hidden="true" />
}
