import { allRooms } from '../model.js'

// Alle bekende HA-ruimtes: uit de sync (meta.ha_areas), uit apparaten en uit bestaande koppelingen.
export function knownHaAreas(home) {
  const devices = [...allRooms(home).flatMap((r) => r.devices), ...home.unassigned_devices]
  return [...new Set([
    ...(home.meta?.ha_areas || []),
    ...devices.map((d) => d.meta?.ha_area),
    ...allRooms(home).map((r) => r.ha_area),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

// Keuzelijst voor de HA-ruimte van een MyHome-ruimte. Kiezen = meteen koppelen (status linked).
export default function HaAreaSelect({ home, room, onLink, id }) {
  const areas = knownHaAreas(home)
  return (
    <select id={id || `ha-area-${room.id}`} value={room.ha_area || ''} aria-label={`Home Assistant area of ${room.name}`}
      onChange={(e) => onLink(e.target.value ? { ha_area: e.target.value, link_status: 'linked' } : { ha_area: null, link_status: 'none' })}>
      <option value="">— not linked —</option>
      {areas.map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  )
}
