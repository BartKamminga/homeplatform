// Installatiesymbolen voor de plattegrond, losjes naar de gangbare NEN-tekenwijze. Maten in meters.

export const DEVICE_KINDS = {
  light: { label: 'Light point', group: 'Light' },
  switch: { label: 'Switch / button', group: 'Light' },
  power_outlet: { label: 'Power outlet', group: 'Power' },
  plug: { label: 'Smart plug', group: 'Power' },
  meter: { label: 'Meter / fuse box', group: 'Power' },
  energy: { label: 'Energy (solar, battery)', group: 'Power' },
  network_outlet: { label: 'Network outlet', group: 'Internet' },
  access_point: { label: 'Wi-Fi access point', group: 'Internet' },
  router: { label: 'Router / switch', group: 'Internet' },
  sensor: { label: 'Sensor', group: 'Devices' },
  thermostat: { label: 'Thermostat / radiator', group: 'Devices' },
  camera: { label: 'Camera', group: 'Devices' },
  speaker: { label: 'Speaker', group: 'Devices' },
  media: { label: 'TV / media', group: 'Devices' },
  appliance: { label: 'Appliance', group: 'Devices' },
  note: { label: 'Note', group: 'Notes' },
  other: { label: 'Other', group: 'Devices' },
}

export const QUICK_ADD = ['power_outlet', 'network_outlet', 'access_point', 'light', 'switch', 'note']

const R = 0.17

function Glyph({ kind }) {
  const ink = 'var(--plan-ink)'
  const s = { stroke: ink, strokeWidth: 0.025, fill: 'none' }
  const t = (txt, size = 0.15) => (
    <text x="0" y={size * 0.36} textAnchor="middle" fontSize={size} fontFamily="var(--mh-mono)" fill={ink}>{txt}</text>
  )
  switch (kind) {
    case 'light':
      return <><circle r={R} {...s} fill="var(--plan-sym)" /><path d={`M${-R * 0.7},${-R * 0.7}L${R * 0.7},${R * 0.7}M${R * 0.7},${-R * 0.7}L${-R * 0.7},${R * 0.7}`} {...s} /></>
    case 'power_outlet':
    case 'plug':
      return <><path d={`M${-R},0A${R},${R} 0 0 1 ${R},0Z`} {...s} fill="var(--plan-sym)" /><path d={`M0,0L0,${R}`} {...s} />{kind === 'plug' && <circle cy={-R * 0.45} r={0.035} fill={ink} />}</>
    case 'network_outlet':
      return <><path d={`M0,${-R}L${R},${R * 0.8}L${-R},${R * 0.8}Z`} {...s} fill="var(--plan-sym)" />{t('N', 0.12)}</>
    case 'note':
      return <><path d={`M${-R},${-R}H${R}V${R * 0.5}H${-R * 0.2}L${-R * 0.6},${R}V${R * 0.5}H${-R}Z`} {...s} fill="var(--plan-note)" />{t('i', 0.16)}</>
    case 'switch':
      return <><circle r={R * 0.75} {...s} fill="var(--plan-sym)" /><path d={`M0,0L${R * 1.1},${-R * 1.1}`} {...s} /></>
    default: {
      const letters = { access_point: 'AP', router: 'R', sensor: 'S', thermostat: 'T', camera: 'C', speaker: 'SP', media: 'TV', appliance: 'A', meter: 'kWh', energy: 'E', other: '•' }
      return <><rect x={-R} y={-R} width={R * 2} height={R * 2} rx={0.04} {...s} fill="var(--plan-sym)" />{t(letters[kind] || '•', (letters[kind] || '').length > 2 ? 0.1 : 0.14)}</>
    }
  }
}

export function DeviceSymbol({ device, x, z, selected, isNew, showLabel, onPointerDown, onClick }) {
  return (
    <g transform={`translate(${x},${z})`} className="mh-plan-device" onPointerDown={onPointerDown} onClick={onClick}>
      {(selected || isNew) && <circle r={R * 1.6} fill="none" stroke={isNew ? 'var(--mh-warn)' : 'var(--mh-accent)'} strokeWidth={0.03} strokeDasharray={isNew ? '0.06 0.04' : undefined} />}
      <Glyph kind={device.kind} />
      {showLabel && (
        <text y={R + 0.2} textAnchor="middle" fontSize={0.13} fontFamily="var(--mh-body)" fill="var(--plan-ink)" className="mh-plan-halo">{device.name}</text>
      )}
      <title>{device.name}</title>
    </g>
  )
}

export function SymbolIcon({ kind, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="-0.25 -0.25 0.5 0.5" aria-hidden="true" style={{ flex: 'none' }}>
      <Glyph kind={kind} />
    </svg>
  )
}
