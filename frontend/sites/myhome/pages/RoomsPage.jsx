import { useState } from 'react'
import { api } from '@core/api.js'
import HaAreaSelect, { knownHaAreas } from '../components/HaAreaSelect.jsx'
import { LINK_STATUS, ROOM_KINDS, allRooms, fmtArea } from '../model.js'

// Ruimtes per verdieping + het koppeloverzicht MyHome-ruimte <-> Home Assistant-ruimte.
export default function RoomsPage({ home, onChange }) {
  const [error, setError] = useState('')
  const rooms = allRooms(home)
  const devices = [...rooms.flatMap((r) => r.devices), ...home.unassigned_devices]

  async function patch(roomId, data) {
    setError('')
    try {
      onChange(await api.patch(`/api/myhome/rooms/${roomId}`, data))
    } catch (e) {
      setError(e.message)
    }
  }

  const coverage = knownHaAreas(home).map((area) => ({
    area,
    rooms: rooms.filter((r) => r.ha_area === area),
    devices: devices.filter((d) => d.meta?.ha_area === area).length,
  }))
  const open = coverage.filter((c) => !c.rooms.length)

  return (
    <div className="mh-page">
      <div>
        <h2>Rooms</h2>
        <p className="mh-muted">{home.floors.length} floors · {fmtArea(home.area_m2)} indoor. Choose the Home Assistant area for every room; its devices move along.</p>
      </div>
      {error && <p className="mh-error">{error}</p>}

      <section>
        <h3>Home Assistant areas · {coverage.length - open.length} of {coverage.length} linked</h3>
        <div className="mh-scroll">
          <table className="mh-table">
            <thead><tr><th>HA area</th><th>Room in the model</th><th className="num">Devices</th></tr></thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.area} className={c.rooms.length ? '' : 'mh-row-open'}>
                  <td>{c.area}</td>
                  <td>
                    {c.rooms.length
                      ? c.rooms.map((r) => <span key={r.id} className={`mh-pill ${r.link_status}`}>{r.floorName} · {r.name}</span>)
                      : (
                        <select id={`cov-${c.area}`} value="" aria-label={`Room for ${c.area}`}
                          onChange={(e) => e.target.value && patch(e.target.value, { ha_area: c.area, link_status: 'linked' })}>
                          <option value="">Not in the model yet — pick a room</option>
                          {rooms.filter((r) => r.kind !== 'outdoor').map((r) => (
                            <option key={r.id} value={r.id}>{r.floorName} · {r.name}{r.ha_area ? ` (now ${r.ha_area})` : ''}</option>
                          ))}
                        </select>
                      )}
                  </td>
                  <td className="num">{c.devices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {home.floors.map((f) => (
        <section key={f.key}>
          <h3>{f.name} · {fmtArea(f.area_m2)}{f.ha_floor ? ` · HA “${f.ha_floor}”` : ''}</h3>
          <div className="mh-scroll">
            <table className="mh-table">
              <thead>
                <tr><th>Room</th><th>Type</th><th className="num">Area</th><th>HA area</th><th>Status</th><th className="num">Devices</th></tr>
              </thead>
              <tbody>
                {f.rooms.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <select id={`kind-${r.id}`} value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value })} aria-label={`Type of ${r.name}`}>
                        {Object.entries(ROOM_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="num">{fmtArea(r.area_m2)}</td>
                    <td><HaAreaSelect home={home} room={{ ...r }} onLink={(data) => patch(r.id, data)} /></td>
                    <td><span className={`mh-pill ${r.link_status}`}>{LINK_STATUS[r.link_status]}</span></td>
                    <td className="num">{r.devices.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
