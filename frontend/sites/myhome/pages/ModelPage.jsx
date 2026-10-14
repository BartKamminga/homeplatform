import { useEffect, useState } from 'react'
import { api } from '@core/api.js'
import HouseViewer from '../components/HouseViewer.jsx'
import RoomPanel from '../components/RoomPanel.jsx'
import DevicePanel from '../components/DevicePanel.jsx'
import PlanView from '../components/plan/PlanView.jsx'
import PlanTray from '../components/plan/PlanTray.jsx'
import { DEVICE_KINDS } from '../components/plan/symbols.jsx'
import { allRooms } from '../model.js'

function useLive(homeId) {
  const [live, setLive] = useState({})
  useEffect(() => {
    let stop = false
    const tick = () => {
      if (document.hidden) return
      api.get(`/api/myhome/homes/${homeId}/live`).then((l) => { if (!stop) setLive(l) }).catch(() => {})
    }
    tick()
    const t = setInterval(tick, 4000)
    return () => { stop = true; clearInterval(t) }
  }, [homeId])
  return live
}

export default function ModelPage({ home, sources, onReload, onHomeChange }) {
  const [view, setView] = useState('2d')
  const [floorKey, setFloorKey] = useState(home.floors[0]?.key)
  const [mode, setMode] = useState('view')
  const [explode, setExplode] = useState(1.6)
  const [highWalls, setHighWalls] = useState(false)
  const [showRoof, setShowRoof] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [deviceId, setDeviceId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [armed, setArmed] = useState(null)
  const [error, setError] = useState('')
  const [focusName, setFocusName] = useState(0)
  const live = useLive(home.id)

  const rooms = allRooms(home)
  const room = rooms.find((r) => r.id === selectedId)
  const floor = home.floors.find((f) => f.key === floorKey) || home.floors[0]
  const floorRoomIds = new Set(floor?.rooms.map((r) => r.id))
  const roomName = Object.fromEntries(rooms.map((r) => [r.id, r.name]))
  const allDevices = [...rooms.flatMap((r) => r.devices), ...home.unassigned_devices]
  const floorDevices = allDevices.filter((d) => floorRoomIds.has(d.room_id) || (!d.room_id && d.meta?.floor === floor?.key))
  const toPlace = allDevices
    .filter((d) => !d.meta?.position && (floorRoomIds.has(d.room_id) || !d.room_id) && d.meta?.review !== 'ignored')
    .map((d) => ({ ...d, roomName: roomName[d.room_id] }))
  const device = allDevices.find((d) => d.id === deviceId)

  async function run(fn) {
    setError('')
    try { await fn() } catch (e) { setError(e.message) }
  }

  const place = (item, pos, target) => run(async () => {
    const meta = { position: pos, floor: floor.key }
    if (item.quickAdd) {
      const label = DEVICE_KINDS[item.quickAdd].label
      await api.post(`/api/myhome/homes/${home.id}/devices`, { name: target ? `${label} ${target.name}` : label, kind: item.quickAdd, room_id: target?.id || null, meta })
    } else {
      const review = item.meta?.review === 'new' ? 'done' : item.meta?.review
      await api.patch(`/api/myhome/devices/${item.id}`, { room_id: target?.id || item.room_id || null, meta: { ...item.meta, ...meta, review } })
    }
    setArmed(null)
    await onReload()
  })

  const saveWalls = () => run(async () => {
    onHomeChange(await api.patch(`/api/myhome/rooms/${room.id}`, { polygon: draft }))
    setDraft(null)
  })

  if (!home.floors.length) {
    return <div className="mh-page"><p className="mh-muted">No floors yet. Add drawings under Inputs; the layout is created from them.</p></div>
  }

  return (
    <>
      <div className="mh-viewer-controls">
        <div className="mh-seg" role="group" aria-label="View">
          <button id="mh-view-2d" aria-pressed={view === '2d'} onClick={() => { setView('2d'); if (floorKey === 'all') setFloorKey(home.floors[0].key) }}>Plan</button>
          <button id="mh-view-3d" aria-pressed={view === '3d'} onClick={() => { setView('3d'); setMode('view'); setDraft(null) }}>3D</button>
        </div>
        <div className="mh-seg" role="group" aria-label="Floor">
          {view === '3d' && <button id="mh-floor-all" aria-pressed={floorKey === 'all'} onClick={() => setFloorKey('all')}>All</button>}
          {home.floors.map((f) => (
            <button key={f.key} id={`mh-floor-${f.key}`} aria-pressed={floorKey === f.key} onClick={() => { setFloorKey(f.key); setDraft(null); setArmed(null) }}>{f.name}</button>
          ))}
        </div>
        {view === '2d' ? (
          <>
            <div className="mh-seg" role="group" aria-label="Mode">
              <button id="mh-mode-view" aria-pressed={mode === 'view'} onClick={() => { setMode('view'); setDraft(null); setArmed(null) }}>View</button>
              <button id="mh-mode-walls" aria-pressed={mode === 'walls'} onClick={() => { setMode('walls'); setArmed(null) }}>Edit walls</button>
              <button id="mh-mode-place" aria-pressed={mode === 'place'} onClick={() => { setMode('place'); setDraft(null) }}>Place items</button>
            </div>
            <label htmlFor="mh-labels"><input id="mh-labels" type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Names</label>
          </>
        ) : (
          <>
            <label htmlFor="mh-explode">Spread <input id="mh-explode" type="range" min="0" max="4" step="0.1" value={explode} onChange={(e) => setExplode(+e.target.value)} /></label>
            <label htmlFor="mh-walls"><input id="mh-walls" type="checkbox" checked={highWalls} onChange={(e) => setHighWalls(e.target.checked)} /> High walls</label>
            <label htmlFor="mh-roof"><input id="mh-roof" type="checkbox" checked={showRoof} onChange={(e) => setShowRoof(e.target.checked)} /> Roof</label>
          </>
        )}
      </div>
      {mode === 'walls' && view === '2d' && (
        <div className="mh-editbar">
          {room ? (
            <>
              <span>Editing <strong>{room.name}</strong>: drag corners (5 cm grid), click a small dot to add a corner, double-click a corner to remove it.</span>
              <span className="mh-spacer" />
              <button className="mh-btn ghost" disabled={!draft} onClick={() => setDraft(null)}>Undo changes</button>
              <button className="mh-btn" disabled={!draft} onClick={saveWalls}>Save walls</button>
            </>
          ) : <span>Click a room to edit its walls.</span>}
        </div>
      )}
      {error && <p className="mh-error" style={{ padding: '6px 16px' }}>{error}</p>}
      <div className="mh-stage">
        {view === '2d' ? (
          <div className="mh-plan-wrap">
            <PlanView floor={floor} devices={floorDevices} live={live} mode={mode} selectedRoomId={selectedId}
              onSelectRoom={(id) => { if (!draft) { setSelectedId(id); setDeviceId(null) } }} draft={draft} onDraftChange={setDraft}
              armed={armed} onPlace={place} selectedDeviceId={deviceId} showLabels={showLabels}
              onSelectDevice={(id) => { setDeviceId(id); setSelectedId(null) }}
              onEditName={({ type, id }) => {
                if (type === 'room') { setSelectedId(id); setDeviceId(null) } else { setDeviceId(id); setSelectedId(null) }
                setFocusName((n) => n + 1)
              }} />
            {mode === 'place' && <PlanTray toPlace={toPlace} armed={armed} onArm={setArmed} />}
          </div>
        ) : (
          <HouseViewer home={home} floor={floorKey} explode={explode} highWalls={highWalls} showRoof={showRoof}
            selectedId={selectedId} onSelect={setSelectedId} live={live} />
        )}
        {room && mode !== 'place' && (
          <RoomPanel home={home} room={room} sources={sources} live={live} focusName={focusName} onHomeChange={onHomeChange} onReload={onReload}
            onClose={() => { setSelectedId(null); setDraft(null) }} />
        )}
        {device && (
          <DevicePanel home={home} device={device} live={live} focusName={focusName} onReload={onReload} onClose={() => setDeviceId(null)} />
        )}
      </div>
    </>
  )
}
