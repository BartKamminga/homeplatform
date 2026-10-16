// Verhouding hartslag/vermogen per rit (item 1351) - zelfde rekenwijze als backend/services/vbt_hr.py.
// De server bewaart het resultaat per rit (ride.hrMetrics); hier rekenen we het zelf uit voor het eindscherm
// en voor ritten die nog niet gesynchroniseerd zijn. sample = [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]
const VERSION = 1, WARMUP = 600, MIN_DURATION = 1800, MIN_VALID = 1200, STEADY_VI = 1.05, BIN = 60

const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d
const avg = a => a.reduce((s, v) => s + v, 0) / a.length

function normalizedPower(w) {
  if (w.length < 30) return avg(w)
  let run = w.slice(0, 30).reduce((s, v) => s + v, 0), sum4 = (run / 30) ** 4, n = 1
  for (let i = 30; i < w.length; i++) { run += w[i] - w[i - 30]; sum4 += (run / 30) ** 4; n++ }
  return (sum4 / n) ** 0.25
}

function fit(pairs) {
  const pts = []
  for (let i = 0; i + BIN <= pairs.length; i += BIN) {
    const b = pairs.slice(i, i + BIN)
    pts.push([avg(b.map(p => p[1])), avg(b.map(p => p[0]))])
  }
  if (pts.length < 10) return null
  const hrs = pts.map(p => p[0])
  if (Math.max(...hrs) - Math.min(...hrs) < 8) return null
  const mh = avg(hrs), mw = avg(pts.map(p => p[1]))
  const b = pts.reduce((s, [h, w]) => s + (h - mh) * (w - mw), 0) / pts.reduce((s, [h]) => s + (h - mh) ** 2, 0)
  if (b <= 0) return null
  return { a: round(mw - b * mh, 2), b: round(b, 4), hrLo: Math.round(Math.min(...hrs)), hrHi: Math.round(Math.max(...hrs)) }
}

export function computeHrMetrics(samples) {
  const out = { v: VERSION, eligible: false }
  if (!samples || samples.length < MIN_DURATION) return out
  const pairs = samples.slice(WARMUP).filter(s => s[3] > 0 && s[5] > 0).map(s => [s[3], s[5]])
  if (pairs.length < MIN_VALID) return out
  const watts = pairs.map(p => p[0])
  const np = normalizedPower(watts), avgW = avg(watts), avgHr = avg(pairs.map(p => p[1]))
  const half = Math.floor(pairs.length / 2)
  const ratio = part => avg(part.map(p => p[0])) / avg(part.map(p => p[1]))
  const r1 = ratio(pairs.slice(0, half)), r2 = ratio(pairs.slice(half))
  return Object.assign(out, {
    eligible: true, ef: round(np / avgHr, 2), np: Math.round(np),
    decoupling: round((r1 - r2) / r1 * 100, 1), steady: np / avgW <= STEADY_VI, fit: fit(pairs),
  })
}

// van de server als die er is (de serveranalyse v2 bevat dezelfde velden plus zones/mmp), anders zelf uitrekenen
export const hrMetricsOf = ride =>
  ride.hrMetrics && ride.hrMetrics.v >= VERSION ? ride.hrMetrics : computeHrMetrics(ride.samples)

// referentiehartslag voor 'watt bij vaste hartslag': 75% van de max-hartslag
export const refHr = () => Math.round(0.75 * ((window.VBT.settings && window.VBT.settings.values.hrMax) || 185))

// watt bij de referentiehartslag, alleen als die binnen het gereden hartslagbereik ligt (niet extrapoleren)
export function wattsAtHr(m, hr) {
  const f = m && m.fit
  if (!f || hr < f.hrLo - 3 || hr > f.hrHi + 3) return null
  return Math.round(f.a + f.b * hr)
}

// kort oordeel over de drift; bij een intervalrit zegt drift weinig
export function driftVerdict(m) {
  if (!m || !m.eligible) return null
  if (!m.steady) return { text: 'INTERVALS - DRIFT NOT MEANINGFUL', color: 'var(--ink)' }
  if (m.decoupling < 5) return { text: 'SOLID AEROBIC BASE', color: '#5dff9e' }
  if (m.decoupling < 10) return { text: 'MODERATE DRIFT', color: 'var(--yellow)' }
  return { text: 'HIGH DRIFT - BUILD BASE, HEAT OR FLUIDS?', color: 'var(--pink)' }
}
