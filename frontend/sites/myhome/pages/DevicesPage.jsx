import { useState } from 'react'
import { api } from '@core/api.js'
import { allRooms } from '../model.js'
import { DEVICE_KINDS, SymbolIcon } from '../components/plan/symbols.jsx'


// Alle IoT-apparaten van het huis; koppelen aan een ruimte gaat met de keuzelijst.
export default function DevicesPage({ home, onReload, initialFilter = 'all' }) {
  const [filter, setFilter] = useState(initialFilter)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', kind: 'light', room_id: '' })
  const rooms = allRooms(home)
  const roomName = Object.fromEntries(rooms.map((r) => [r.id, `${r.floorName} · ${r.name}`]))
  const devices = [...rooms.flatMap((r) => r.devices), ...home.unassigned_devices]
  const sources = [...new Set(devices.map((d) => d.source))]
  const review = (d) => d.meta?.review
  const shown = devices.filter((d) => {
    if (filter === 'new') return review(d) === 'new'
    if (filter === 'ignored') return review(d) === 'ignored'
    if (review(d) === 'ignored') return false
    return filter === 'all' || (filter === 'unassigned' ? !d.room_id : d.source === filter)
  })
  const setReview = (d, value) => run(() => api.patch(`/api/myhome/devices/${d.id}`, { meta: { ...d.meta, review: value } }))

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
        <p className="mh-muted">{devices.length} devices · {home.unassigned_devices.length} not yet in a room. Synced devices come from Home Assistant, Hue and other connections. Place them on the plan under Model → Place items.</p>
      </div>
      <div className="mh-seg" role="group" aria-label="Filter">
        {['all', 'new', 'unassigned', ...sources, 'ignored'].map((f) => (
          <button key={f} id={`dev-filter-${f}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}{f === 'new' && home.review_count ? ` · ${home.review_count}` : ''}</button>
        ))}
      </div>
      {error && <p className="mh-error">{error}</p>}
      <div className="mh-scroll">
        <table className="mh-table">
          <thead><tr><th>Device</th><th>Type</th><th>Source</th><th>Room</th><th>Plan</th><th /></tr></thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="mh-row" style={{ gap: 6 }}><SymbolIcon kind={d.kind} size={18} />{d.name}{review(d) === 'new' && <span className="mh-pill proposed">new</span>}</span>
                  {d.meta?.ha_area && <div className="mh-muted">HA area: {d.meta.ha_area}</div>}
                </td>
                <td>
                  <select id={`kind-${d.id}`} value={d.kind} aria-label={`Type of ${d.name}`}
                    onChange={(e) => run(() => api.patch(`/api/myhome/devices/${d.id}`, { kind: e.target.value }))}>
                    {Object.entries(DEVICE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </td>
                <td>{d.source}</td>
                <td>
                  <select id={`room-${d.id}`} value={d.room_id || ''} aria-label={`Room of ${d.name}`}
                    onChange={(e) => run(() => api.patch(`/api/myhome/devices/${d.id}`, { room_id: e.target.value || null }))}>
                    <option value="">— not assigned —</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{roomName[r.id]}</option>)}
                  </select>
                </td>
                <td className="mh-muted">{d.meta?.position ? 'placed' : '—'}</td>
                <td className="mh-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  {review(d) === 'new' && <button className="mh-btn" onClick={() => setReview(d, 'done')}>Confirm</button>}
                  {review(d) === 'ignored'
                    ? <button className="mh-btn ghost" onClick={() => setReview(d, 'done')}>Restore</button>
                    : d.source === 'manual'
                      ? <button className="mh-btn ghost" onClick={() => run(() => api.delete(`/api/myhome/devices/${d.id}`))}>Remove</button>
                      : <button className="mh-btn ghost" onClick={() => setReview(d, 'ignored')}>Ignore</button>}
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="mh-muted">No devices in this view.</td></tr>}
          </tbody>
        </table>
      </div>
      <form onSubmit={add}>
        <h3>Add a device by hand</h3>
        <div className="mh-form">
          <input id="dev-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Device name" />
          <select id="dev-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Device type">
            {Object.entries(DEVICE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
