import { useState } from 'react'
import { api } from '@core/api.js'
import { LINK_STATUS, ROOM_KINDS, fmtArea } from '../model.js'

// Ruimtes per verdieping, met koppeling naar Home Assistant direct te bewerken.
export default function RoomsPage({ home, onChange }) {
  const [error, setError] = useState('')

  async function patch(roomId, data) {
    setError('')
    try {
      onChange(await api.patch(`/api/myhome/rooms/${roomId}`, data))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="mh-page">
      <div>
        <h2>Rooms</h2>
        <p className="mh-muted">{home.floors.length} floors · {fmtArea(home.area_m2)} indoor. Link each room to its Home Assistant area.</p>
      </div>
      {error && <p className="mh-error">{error}</p>}
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
                    <td>
                      <input id={`ha-${r.id}`} defaultValue={r.ha_area || ''} placeholder="—" aria-label={`HA area of ${r.name}`}
                        onBlur={(e) => { if ((e.target.value || null) !== r.ha_area) patch(r.id, { ha_area: e.target.value || null }) }} />
                    </td>
                    <td>
                      <select id={`st-${r.id}`} value={r.link_status} onChange={(e) => patch(r.id, { link_status: e.target.value })} aria-label={`Link status of ${r.name}`}>
                        {Object.entries(LINK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
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
