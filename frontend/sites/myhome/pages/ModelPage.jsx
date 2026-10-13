import { useState } from 'react'
import HouseViewer from '../components/HouseViewer.jsx'
import { LINK_STATUS, ROOM_KINDS, allRooms, fmtArea } from '../model.js'

export default function ModelPage({ home }) {
  const [floor, setFloor] = useState('all')
  const [explode, setExplode] = useState(1.6)
  const [highWalls, setHighWalls] = useState(false)
  const [showRoof, setShowRoof] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const room = allRooms(home).find((r) => r.id === selectedId)

  if (!home.floors.length) {
    return <div className="mh-page"><p className="mh-muted">No floors yet. Add drawings under Inputs; the layout is created from them.</p></div>
  }

  return (
    <>
      <div className="mh-viewer-controls">
        <div className="mh-seg" role="group" aria-label="Floor">
          <button id="mh-floor-all" aria-pressed={floor === 'all'} onClick={() => setFloor('all')}>All</button>
          {home.floors.map((f) => (
            <button key={f.key} id={`mh-floor-${f.key}`} aria-pressed={floor === f.key} onClick={() => setFloor(f.key)}>{f.name}</button>
          ))}
        </div>
        <label htmlFor="mh-explode">Spread
          <input id="mh-explode" type="range" min="0" max="4" step="0.1" value={explode} onChange={(e) => setExplode(+e.target.value)} />
        </label>
        <label htmlFor="mh-walls"><input id="mh-walls" type="checkbox" checked={highWalls} onChange={(e) => setHighWalls(e.target.checked)} /> High walls</label>
        <label htmlFor="mh-roof"><input id="mh-roof" type="checkbox" checked={showRoof} onChange={(e) => setShowRoof(e.target.checked)} /> Roof</label>
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
        <HouseViewer home={home} floor={floor} explode={explode} highWalls={highWalls} showRoof={showRoof}
          selectedId={selectedId} onSelect={setSelectedId} />
        {room && (
          <div className="mh-room-card">
            <div className="mh-row" style={{ justifyContent: 'space-between' }}>
              <div><h3 style={{ margin: 0 }}>{room.floorName}</h3><h2>{room.name}</h2></div>
              <button className="mh-btn ghost" onClick={() => setSelectedId(null)} aria-label="Close">×</button>
            </div>
            <dl className="mh-dl">
              <dt>Area</dt><dd className="mh-mono">{fmtArea(room.area_m2)}</dd>
              <dt>Type</dt><dd><span className="mh-sw" style={{ background: ROOM_KINDS[room.kind]?.color }} />{ROOM_KINDS[room.kind]?.label}</dd>
              <dt>HA area</dt><dd>{room.ha_area || '—'}</dd>
              <dt>Status</dt><dd><span className={`mh-pill ${room.link_status}`}>{LINK_STATUS[room.link_status]}</span></dd>
              <dt>Devices</dt><dd>{room.devices.length ? room.devices.map((d) => d.name).join(', ') : '—'}</dd>
            </dl>
            {room.notes && <p className="mh-muted">{room.notes}</p>}
          </div>
        )}
      </div>
    </>
  )
}
