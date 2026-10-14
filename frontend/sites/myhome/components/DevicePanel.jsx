import { useEffect, useRef, useState } from 'react'
import { api } from '@core/api.js'
import { allRooms, liveSummary } from '../model.js'
import { DEVICE_KINDS, SymbolIcon } from './plan/symbols.jsx'
import ConnectionEditor from './ConnectionEditor.jsx'

// Apparaat op de plattegrond: hernoemen, soort, ruimte; laat zien hoe het in HA heet en waar het daar staat.
export default function DevicePanel({ home, device, devices, live, focusName, onReload, onClose }) {
  const [name, setName] = useState(device.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const rooms = allRooms(home).filter((r) => r.kind !== 'outdoor')
  const room = rooms.find((r) => r.id === device.room_id)
  const meta = device.meta || {}
  const s = liveSummary(live[device.id])

  useEffect(() => { setName(device.name); setConfirmDelete(false) }, [device.id, device.name])
  useEffect(() => { if (focusName) nameRef.current?.select() }, [focusName, device.id])

  async function patch(data) {
    setError('')
    try { await api.patch(`/api/myhome/devices/${device.id}`, data); await onReload() } catch (e) { setError(e.message) }
  }
  const saveName = () => { if (name.trim() && name.trim() !== device.name) patch({ name: name.trim() }) }

  return (
    <div className="mh-room-card">
      <div className="mh-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0 }}><SymbolIcon kind={device.kind} size={16} /> {DEVICE_KINDS[device.kind]?.label || device.kind}</h3>
          <input ref={nameRef} id={`dev-name-${device.id}`} className="mh-title-input" value={name} aria-label="Device name"
            onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </div>
        <button className="mh-btn ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      <dl className="mh-dl">
        <dt>Room</dt>
        <dd>
          <select id={`dev-room-${device.id}`} value={device.room_id || ''} aria-label="Room" onChange={(e) => patch({ room_id: e.target.value || null })}>
            <option value="">— not assigned —</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.floorName} · {r.name}</option>)}
          </select>
        </dd>
        <dt>Type</dt>
        <dd>
          <select id={`dev-kind-${device.id}`} value={device.kind} aria-label="Type" onChange={(e) => patch({ kind: e.target.value })}>
            {Object.entries(DEVICE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </dd>
        <dt>Now</dt><dd>{s.on ? 'on' : s.open ? 'open' : s.motion ? 'motion' : s.any ? 'idle' : '—'}</dd>
      </dl>
      {(meta.ha_name || meta.ha_area) && (
        <div>
          <h3>In Home Assistant</h3>
          <dl className="mh-dl">
            <dt>Name</dt><dd className={meta.ha_name && meta.ha_name !== device.name ? 'mh-diff' : ''}>{meta.ha_name || '—'}</dd>
            <dt>Area</dt><dd className={room?.ha_area && meta.ha_area !== room.ha_area ? 'mh-diff' : ''}>{meta.ha_area || '—'}</dd>
            <dt>Source</dt><dd>{device.source}{device.manufacturer ? ` · ${device.manufacturer}` : ''}</dd>
          </dl>
          {((meta.ha_name && meta.ha_name !== device.name) || (room?.ha_area && meta.ha_area !== room.ha_area)) && (
            <p className="mh-muted">Differs from Home Assistant (see <strong>vs HA</strong>).</p>
          )}
        </div>
      )}
      <ConnectionEditor device={device} devices={devices} onMeta={(m) => patch({ meta: m })} />
      <div className="mh-row">
        {meta.position && (
          <button className="mh-btn ghost" onClick={() => {
            const rest = { ...meta }
            delete rest.position
            delete rest.floor
            patch({ meta: rest }).then(onClose)
          }}>Remove from plan</button>
        )}
        {device.source === 'manual' && (confirmDelete ? (
          <>
            <span className="mh-muted">Delete for good?</span>
            <button className="mh-btn danger" onClick={async () => {
              try { await api.delete(`/api/myhome/devices/${device.id}`); await onReload(); onClose() } catch (e) { setError(e.message) }
            }}>Delete</button>
            <button className="mh-btn ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
          </>
        ) : (
          <button className="mh-btn ghost" onClick={() => setConfirmDelete(true)}>Delete…</button>
        ))}
      </div>
      {error && <p className="mh-error">{error}</p>}
    </div>
  )
}
