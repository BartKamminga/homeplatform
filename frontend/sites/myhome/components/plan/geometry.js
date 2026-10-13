// Rekenhulp voor de 2D-plattegrond. Alle maten in meters; x = links→rechts, z = tuin→straat.

export const SNAP = 0.05

export const snap = (v, step = SNAP) => Math.round(v / step) * step

export function centroid(p) {
  return p.reduce(([a, b], [x, z]) => [a + x / p.length, b + z / p.length], [0, 0])
}

export function polygonArea(p) {
  let s = 0
  p.forEach(([x1, z1], i) => {
    const [x2, z2] = p[(i + 1) % p.length]
    s += x1 * z2 - x2 * z1
  })
  return Math.abs(s) / 2
}

export function pointInPolygon([x, z], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function roomAt(point, rooms) {
  // Binnenruimtes gaan voor buitenruimtes, kleinste ruimte eerst (bv. meterkast binnen de hal).
  const hits = rooms.filter((r) => r.polygon?.length > 2 && pointInPolygon(point, r.polygon))
  hits.sort((a, b) => (a.kind === 'outdoor') - (b.kind === 'outdoor') || polygonArea(a.polygon) - polygonArea(b.polygon))
  return hits[0] || null
}

export function floorBounds(rooms, pad = 1.2) {
  const pts = rooms.flatMap((r) => r.polygon || [])
  if (!pts.length) return { x: -5, z: -5, w: 10, h: 10 }
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  const minX = Math.min(...xs) - pad
  const minZ = Math.min(...zs) - pad
  return { x: minX, z: minZ, w: Math.max(...xs) + pad - minX, h: Math.max(...zs) + pad - minZ }
}

// Maatlijn per wand: middenpunt iets naar buiten geschoven, met lengte en hoek.
export function edgeDimensions(poly) {
  const [cx, cz] = centroid(poly)
  return poly.map(([x1, z1], i) => {
    const [x2, z2] = poly[(i + 1) % poly.length]
    const len = Math.hypot(x2 - x1, z2 - z1)
    const mx = (x1 + x2) / 2
    const mz = (z1 + z2) / 2
    let nx = -(z2 - z1) / (len || 1)
    let nz = (x2 - x1) / (len || 1)
    if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz }
    let angle = (Math.atan2(z2 - z1, x2 - x1) * 180) / Math.PI
    if (angle > 90) angle -= 180
    if (angle < -90) angle += 180
    return { len, x: mx + nx * 0.32, z: mz + nz * 0.32, angle, index: i }
  })
}

export const fmtLen = (m) => m.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function toSvgPoint(svg, e) {
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const p = pt.matrixTransform(svg.getScreenCTM().inverse())
  return [p.x, p.y]
}
