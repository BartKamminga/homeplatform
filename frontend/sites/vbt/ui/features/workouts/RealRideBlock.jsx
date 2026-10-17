// Real Ride bij een eigen GPX-route (prototype): eerst straatfoto's zoeken (server, Mapillary), dan rijden met
// echte beelden. Gegenereerde routes hebben geen echte plek, dus daar niet.
import { useEffect, useState } from 'react'
import { actions } from '../../hooks/useVbt.js'
import { startWithConfirm } from '../../common/format.js'

export default function RealRideBlock({ route }) {
  const VBT = window.VBT
  const [configured, setConfigured] = useState(null)
  const [count, setCount] = useState(route.photoCount || 0)
  const [busy, setBusy] = useState(false)
  useEffect(() => { VBT.storage.realrideStatus().then(r => setConfigured(!!r.configured)).catch(() => setConfigured(false)) }, [])
  useEffect(() => { setCount(route.photoCount || 0) }, [route.id])
  if (!route.route || route.source === 'generated') return null

  const find = async () => {
    setBusy(true)
    try {
      const r = await VBT.storage.findRoutePhotos(route.id)
      setCount(r.photoCount)
      route.photoCount = r.photoCount
      VBT.toast?.('FOUND ' + r.photoCount + ' STREET PHOTOS FOR ' + r.sections + ' SECTIONS', 6000)
    } catch (e) { VBT.toast?.('PHOTOS: ' + e.message, 7000) }
    setBusy(false)
  }
  const ride = () => startWithConfirm(route.name + ' (Real Ride)', async () => {
    actions().startWorkout(route)
    const n = await VBT.realride.start(route).catch(() => 0)
    if (!n) VBT.toast?.('NO PHOTOS LOADED - RIDING THE NORMAL ROAD', 6000)
  })

  return (
    <div className="pn-realride">
      <small>REAL RIDE · BETA</small>
      {!route.hasPoints ? <p className="pn-hint">Import this GPX again to ride it with street photos (older imports have no coordinates).</p>
        : configured === false ? <p className="pn-hint">Real Ride needs a Mapillary token on the server (MAPILLARY_TOKEN).</p>
          : (
            <div className="pn-buttons">
              <button id="rrFind" className="ghostbtn" disabled={busy || configured === null} onClick={find}>
                {busy ? 'SEARCHING PHOTOS…' : count ? '↻ SEARCH PHOTOS AGAIN' : '⌕ FIND STREET PHOTOS'}</button>
              {count > 0 && <button id="rrRide" className="ridebtn" onClick={ride}>REAL RIDE &#9654;</button>}
            </div>
          )}
      {count > 0 && <p className="pn-hint">{count} street photos along this route (Mapillary, CC BY-SA). Where there are none you see the normal road.</p>}
    </div>
  )
}
