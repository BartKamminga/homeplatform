// Geometrie voor de arcade-grafiek (item 1337) — zelfde schaal en logica als classic SmoothChart.
export const WIDTH = 720
export const HEIGHT = 180
export const PAD_TOP = 34
export const PAD_BOTTOM = 44
export const HANDLE_Y = 9
export const LABEL_MIN_Y = 26

export const C = {
  ink: '#f4f1ff', muted: '#8a8aa8', cyan: '#24e8ff', pink: '#ff2e88', yellow: '#ffe66d',
  purple: '#9b5cff', bg: '#07011a', grid: 'rgba(244,241,255,.07)',
}
export const FONT_HUD = "Orbitron, 'Arial Black', sans-serif"
export const FONT_PIXEL = "'Press Start 2P', monospace"

// Vloeiende curve door de punten (quadratic Bézier via de midpunten).
export function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    d += ` Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
  }
  const [lx, ly] = points[points.length - 1]
  return `${d} T ${lx},${ly}`
}

// Fractionele uur-index van "nu", of null buiten bereik.
export function nowIndex(hours) {
  const now = new Date()
  const first = new Date(hours[0].time)
  const last = new Date(hours[hours.length - 1].time)
  if (now < first || now > last) return null
  for (let i = 0; i < hours.length - 1; i++) {
    const t0 = new Date(hours[i].time)
    const t1 = new Date(hours[i + 1].time)
    if (now >= t0 && now <= t1) return i + (now - t0) / (t1 - t0)
  }
  return hours.length - 1
}

export function nightBands(hours) {
  const bands = []
  let start = null
  hours.forEach((h, i) => {
    const isNight = h.daylight_state === 'nacht'
    if (isNight && start === null) start = i
    if (!isNight && start !== null) { bands.push([start, i - 1]); start = null }
  })
  if (start !== null) bands.push([start, hours.length - 1])
  return bands
}
