import { useState } from 'react'
import { api } from '@core/api.js'
import { allRooms } from '../model.js'

const DEVICE_KINDS = ['light', 'sensor', 'switch', 'plug', 'thermostat', 'camera', 'speaker', 'media', 'appliance', 'other']

// Alle IoT-apparaten van het huis; koppelen aan een ruimte gaat met de keuzelijst.
export default function DevicesPage({ home, onReload }) {
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', kind: 'light', room_id: '' })
  const rooms = allRooms(home)
  const roomName = Object.fromEntries(rooms.map((r) => [r.id, `${r.floorName} · ${r.name}`]))
  const devices = [...rooms.flatMap((r) => r.devices), ...home.unassigned_devices]
  const sources = [...new Set(devices.map((d) => d.source))]
  const shown = devices.filter((d) => filter === 'all' || (filter === 'unassigned' ? !d.room_id : d.source === filter))

  async function run(fn) {
    setError('')
    try { await fn(); await onReload() } catch (e) { setError(e.message) }
  }

  const add = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    run(async () => {
      await api.post(`/api/myhome/homes/${home.id}/devices`, { ...form, room_id: form.room_id || null })
      setForm({ ...form, name: '' })
    })
  }

  return (
    <div className="mh-page">
      <div>
        <h2>Devices</h2>
        <p className="mh-muted">{devices.length} devices · {home.unassigned_devices.length} not yet in a room. Synced devices come from Home Assistant, Hue and other connections.</p>
      </div>
      <div className="mh-seg" role="group" aria-label="Filter">
        {['all', 'unassigned', ...sources].map((f) => (
          <button key={f} id={`dev-filter-${f}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {error && <p className="mh-error">{error}</p>}
      <div className="mh-scroll">
        <table className="mh-table">
          <thead><tr><th>Device</th><th>Type</th><th>Source</th><th>Room</th><th /></tr></thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id}>
                <td>{d.name}{d.external_id && <div className="mh-muted mh-mono">{d.external_id}</div>}</td>
                <td>{d.kind}</td>
                <td>{d.source}</td>
                <td>
                  <select id={`room-${d.id}`} value={d.room_id || ''} aria-label={`Room of ${d.name}`}
                    onChange={(e) => run(() => api.patch(`/api/myhome/devices/${d.id}`, { room_id: e.target.value || null }))}>
                    <option value="">— not assigned —</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{roomName[r.id]}</option>)}
                  </select>
                </td>
                <td><button className="mh-btn ghost" onClick={() => run(() => api.delete(`/api/myhome/devices/${d.id}`))}>Remove</button></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={5} className="mh-muted">No devices in this view.</td></tr>}
          </tbody>
        </table>
      </div>
      <form onSubmit={add}>
        <h3>Add a device by hand</h3>
        <div className="mh-form">
          <input id="dev-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Device name" />
          <select id="dev-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Device type">
            {DEVICE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select id="dev-room" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} aria-label="Room">
            <option value="">— not assigned —</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{roomName[r.id]}</option>)}
          </select>
          <button className="mh-btn" type="submit">Add device</button>
        </div>
      </form>
    </div>
  )
}
