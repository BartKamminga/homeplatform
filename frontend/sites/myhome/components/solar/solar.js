// Zonnepanelen: model in home.meta.solar (item 1330).
//   arrays: [{ id, name, x, z, rotation, orientation, rows, cols, panel_w, panel_h, wp, azimuth, tilt }]
//   panels: { "<arrayId>:<row>:<col>": { serial, ref_wh, unsure } }
//   calib:  { date, wh: { serial: Wh } }  - opbrengst per omvormer uit HA, om panelen te koppelen
// Een paneel hoort bij een micro-omvormer (serienummer); het vermogen komt live uit sensor.inverter_<serie>.

export const GAP = 0.03

export function panelSize(a) {
  const w = a.panel_w || 1.0
  const h = a.panel_h || 1.7
  return a.orientation === 'landscape' ? [h, w] : [w, h]
}

export function arrayPanels(a) {
  const [w, h] = panelSize(a)
  const out = []
  for (let r = 0; r < a.rows; r++) {
    for (let c = 0; c < a.cols; c++) {
      out.push({ key: `${a.id}:${r}:${c}`, x: c * (w + GAP), z: r * (h + GAP), w, h })
    }
  }
  return out
}

export function arraySize(a) {
  const [w, h] = panelSize(a)
  return [a.cols * w + (a.cols - 1) * GAP, a.rows * h + (a.rows - 1) * GAP]
}

// Serienummer -> { device, watt } uit de Enphase-apparaten en de live-status.
export function inverterIndex(devices, live) {
  const out = {}
  for (const d of devices) {
    const ent = (d.meta?.entities || []).find((e) => e.startsWith('sensor.inverter_'))
    if (!ent) continue
    const serial = ent.replace('sensor.inverter_', '')
    const st = live[d.id]?.[ent]?.state
    const watt = st == null || st === 'unavailable' || st === 'unknown' ? null : Number(st)
    out[serial] = { device: d, watt: Number.isFinite(watt) ? watt : null }
  }
  return out
}

// Kleur van wit-geel (veel) naar donkerblauw (weinig); grijs zonder gegevens.
export function panelColor(watt, max) {
  if (watt == null || !max) return 'var(--solar-none)'
  const t = Math.max(0, Math.min(1, watt / max))
  const lerp = (a, b) => Math.round(a + (b - a) * t)
  return `rgb(${lerp(24, 255)}, ${lerp(52, 196)}, ${lerp(98, 64)})`
}

export const newArrayId = () => `arr-${Math.random().toString(36).slice(2, 8)}`
