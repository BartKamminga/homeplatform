import { useEffect, useRef, useState } from 'react'
import { api } from '@core/api.js'
import { uploadImageFile } from '@core/uploadImage.js'
import { LINK_STATUS, ROOM_KINDS, fmtArea, liveSummary } from '../model.js'
import PhotoColorPicker from './PhotoColorPicker.jsx'
import HaAreaSelect from './HaAreaSelect.jsx'

// Detailkaart van een ruimte: gegevens, uiterlijk (muur/vloer), foto's van de ruimte en apparaten.
export default function RoomPanel({ home, room, sources, live, focusName, onHomeChange, onReload, onClose }) {
  const [picker, setPicker] = useState(null)
  const [name, setName] = useState(room.name)
  const [zone, setZone] = useState(room.meta?.zone || '')
  const nameRef = useRef(null)
  useEffect(() => { setName(room.name); setZone(room.meta?.zone || '') }, [room.id, room.name, room.meta?.zone])
  useEffect(() => { if (focusName) nameRef.current?.select() }, [focusName, room.id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photos = sources.filter((s) => s.room_id === room.id)

  async function run(fn) {
    setError(''); setBusy(true)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const setLook = (key, value) => run(async () => {
    onHomeChange(await api.patch(`/api/myhome/rooms/${room.id}`, { meta: { ...room.meta, [key]: value } }))
  })
  const upload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    run(async () => {
      const url = await uploadImageFile(file, 'myhome')
      await api.post(`/api/myhome/homes/${home.id}/sources`, {
        kind: 'photo', title: `${room.name} - ${file.name}`, file_path: url.replace('/api/uploads/', ''), room_id: room.id,
      })
      e.target.value = ''
      await onReload()
    })
  }

  return (
    <div className="mh-room-card">
      <div className="mh-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0 }}>{room.floorName}{room.meta?.zone ? ` · ${room.meta.zone}` : ''}</h3>
          <input ref={nameRef} id={`room-name-${room.id}`} className="mh-title-input" value={name} aria-label="Room name"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={() => name.trim() && name.trim() !== room.name && run(async () => onHomeChange(await api.patch(`/api/myhome/rooms/${room.id}`, { name: name.trim() })))} />
        </div>
        <button className="mh-btn ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      <dl className="mh-dl">
        <dt>Area</dt><dd className="mh-mono">{fmtArea(room.area_m2)}</dd>
        <dt>Type</dt>
        <dd>
          <select id={`room-kind-${room.id}`} value={room.kind} aria-label="Room type"
            onChange={(e) => run(async () => onHomeChange(await api.patch(`/api/myhome/rooms/${room.id}`, { kind: e.target.value })))}>
            {Object.entries(ROOM_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </dd>
        <dt>Zone</dt>
        <dd>
          <input id={`room-zone-${room.id}`} value={zone} placeholder="e.g. Tinyhouse" aria-label="Zone" list="mh-zones"
            onChange={(e) => setZone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={() => zone !== (room.meta?.zone || '') && setLook('zone', zone.trim() || null)} />
          <datalist id="mh-zones">{[...new Set(home.floors.flatMap((f) => f.rooms.map((r) => r.meta?.zone)).filter(Boolean))].map((z) => <option key={z} value={z} />)}</datalist>
        </dd>
        <dt>HA area</dt>
        <dd className="mh-row">
          <HaAreaSelect home={home} room={room} id={`panel-ha-${room.id}`}
            onLink={(data) => run(async () => onHomeChange(await api.patch(`/api/myhome/rooms/${room.id}`, data)))} />
          <span className={`mh-pill ${room.link_status}`}>{LINK_STATUS[room.link_status]}</span>
        </dd>
      </dl>
      {room.notes && <p className="mh-muted">{room.notes}</p>}

      <div>
        <h3>Look</h3>
        <div className="mh-row">
          <label className="mh-color" htmlFor={`wall-${room.id}`}>
            <input id={`wall-${room.id}`} type="color" value={room.meta?.wall_color || '#efece6'} onChange={(e) => setLook('wall_color', e.target.value)} /> Walls
          </label>
          <label className="mh-color" htmlFor={`floor-${room.id}`}>
            <input id={`floor-${room.id}`} type="color" value={room.meta?.floor_color || ROOM_KINDS[room.kind]?.color || '#dddddd'} onChange={(e) => setLook('floor_color', e.target.value)} /> Floor
          </label>
        </div>
      </div>

      <div>
        <h3>Photos of this room · {photos.length}</h3>
        <div className="mh-thumbs">
          {photos.map((p) => (
            <button key={p.id} className="mh-thumb" onClick={() => setPicker(p)} title="Open and pick colours">
              <img src={p.url} alt={p.title} loading="lazy" />
            </button>
          ))}
          <label className="mh-thumb add" htmlFor={`photo-${room.id}`}>
            <input id={`photo-${room.id}`} type="file" accept="image/*" capture="environment" onChange={upload} disabled={busy} hidden />
            <span>+ Photo</span>
          </label>
        </div>
      </div>

      <div>
        <h3>Devices · {room.devices.length}</h3>
        <ul className="mh-list">
          {room.devices.slice(0, 12).map((d) => {
            const s = liveSummary(live[d.id])
            return (
              <li key={d.id} className="mh-row" style={{ justifyContent: 'space-between' }}>
                <span>{d.name}</span>
                <span className="mh-muted">{s.on ? 'on' : s.open ? 'open' : s.motion ? 'motion' : d.kind}</span>
              </li>
            )
          })}
          {room.devices.length > 12 && <li className="mh-muted">+ {room.devices.length - 12} more</li>}
        </ul>
      </div>
      {error && <p className="mh-error">{error}</p>}
      {picker && (
        <PhotoColorPicker source={picker} onClose={() => setPicker(null)}
          onUse={(key, value) => { setLook(key, value); setPicker(null) }} />
      )}
    </div>
  )
}
