// Gedeelde constanten en helpers voor het huismodel (item 1314).

export const ROOM_KINDS = {
  living: { label: 'Living', color: '#e6dbc2' },
  bedroom: { label: 'Bedroom', color: '#c3dcae' },
  wet: { label: 'Bathroom / toilet', color: '#9fb3d4' },
  circulation: { label: 'Hall / landing', color: '#c7b5a3' },
  storage: { label: 'Storage', color: '#d3d4d2' },
  outdoor: { label: 'Outdoor', color: '#b9c0bb' },
  roof: { label: 'Roof plane', color: '#c9a48f' },
  garden: { label: 'Garden', color: '#b7d3a3' },
}

// Ruimtes zonder muren en buiten het woonoppervlak: buiten, dakvlakken, tuin.
export const OPEN_KINDS = ['outdoor', 'roof', 'garden']
export const isOpen = (kind) => OPEN_KINDS.includes(kind)

// Live vermogen (W) van een zonnepaneel: de sensor.inverter_<serie> van de micro-omvormer.
export function panelWatt(device, live) {
  const ent = (device.meta?.entities || []).find((e) => e.startsWith('sensor.inverter_'))
  const st = ent && live[device.id]?.[ent]?.state
  const w = st == null ? NaN : Number(st)
  return Number.isFinite(w) ? w : null
}

export const LINK_STATUS = {
  linked: 'Linked',
  proposed: 'Proposed',
  none: 'Not linked',
}

export const CONNECTION_STATUS = {
  active: 'Active',
  planned: 'Planned',
  broken: 'Needs attention',
}

export const fmtArea = (n) =>
  `${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`

export const allRooms = (home) => (home?.floors || []).flatMap((f) => f.rooms.map((r) => ({ ...r, floorName: f.name })))

// Hoogte van het dak boven een x-positie (lineair tussen de punten van roof.line).
export function roofHeight(roof, x) {
  const line = roof?.line
  if (!line?.length) return Infinity
  const pts = [...line].sort((a, b) => a[0] - b[0])
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [x1, h1] = pts[i - 1]
    const [x2, h2] = pts[i]
    if (x <= x2) return h1 + ((h2 - h1) * (x - x1)) / (x2 - x1 || 1)
  }
  return pts[pts.length - 1][1]
}

// Live-status van een apparaat uit meta.live (gevuld door HA-events): aan, open, beweging.
export function liveSummary(liveEntries) {
  const out = { on: false, open: false, motion: false, any: false }
  for (const [entity, v] of Object.entries(liveEntries || {})) {
    const domain = entity.split('.')[0]
    const on = ['on', 'open', 'unlocked', 'playing'].includes(v.state)
    out.any = true
    if (domain === 'light' || domain === 'switch' || domain === 'media_player') out.on ||= on
    else if (domain === 'binary_sensor' && ['motion', 'occupancy', 'presence'].includes(v.device_class)) out.motion ||= on
    else if (domain === 'binary_sensor' || domain === 'cover' || domain === 'lock') out.open ||= on
  }
  return out
}
