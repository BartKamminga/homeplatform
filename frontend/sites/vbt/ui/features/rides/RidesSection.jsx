// MY RIDES: alle ritten (ook nog niet gesynchroniseerde), detail met grafiek, pauzes, eventlog,
// .FIT, CONTINUE RIDE en prullenbak (terugzetten). Als lijst of per week (RidesWeeks).
// Tijdens een rit alleen-lezen: niets starten, verwijderen of terugzetten (alleen bekijken en .FIT).
import { useCallback, useEffect, useState } from 'react'
import { actions, isRiding, useVbtValue } from '../../hooks/useVbt.js'
import { fmtDur, fmtDateTime } from '../../common/format.js'
import RidesWeeks from './RidesWeeks.jsx'
import RideDetail from './RideDetail.jsx'

// LIST of WEEKS onthouden (alleen gemak, per browser)
const VIEW_KEY = 'vbt.ridesView'
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || 'list' } catch { return 'list' } }

function Tags({ r }) {
  const current = window.VBT.recorder.current()
  const live = r.inProgress && !(current && current.clientId === r.clientId)
  return (
    <>
      {r.pending && <i className="tag pending">NOT SYNCED</i>}
      {r.inProgress && <i className={'tag ' + (live ? 'pending' : 'wo')}>{live ? 'INTERRUPTED' : 'IN PROGRESS'}</i>}
      {r.recovered && <i className="tag wo">RECOVERED</i>}
      {r.pb && <i className="tag pb">PB</i>}
      {r.rpe && <i className="tag rpe" title="How hard (RPE 1-10)">RPE {r.rpe}</i>}
      {r.kind === 'workout' && <i className="tag wo">WORKOUT</i>}
      {r.kind === 'climb' && <i className="tag wo">CLIMB</i>}
      {r.stravaActivityId && <i className="tag strava">STRAVA</i>}
    </>
  )
}

export default function RidesSection() {
  const [trash, setTrash] = useState(false)
  const [view, setViewState] = useState(readView)
  const setView = v => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* geen opslag */ } }
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [ride, setRide] = useState(null)
  const riding = useVbtValue(s => isRiding(s.state))

  const load = useCallback(async (keep) => {
    let list = []
    if (trash) {
      try { list = await window.VBT.storage.listTrash() } catch { list = [] }
    } else {
      let server = []
      try { server = await actions().listRides() } catch (e) { window.VBT.toast?.('RIDES: ' + e.message, 6000) }
      const synced = new Set(server.map(r => r.clientId).filter(Boolean))
      const local = (await actions().pendingRides()).filter(r => !synced.has(r.clientId))
        .map(r => ({ ...r, id: 'local:' + r.clientId, pending: true }))
      list = [...local, ...server].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    }
    setItems(list)
    const id = keep && list.some(r => r.id === keep) ? keep : list[0]?.id
    setSelected(id || null)
  }, [trash])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (riding) setTrash(false) }, [riding])

  useEffect(() => {
    if (!selected) { setRide(null); return }
    let alive = true
    const local = items.find(r => r.id === selected && r.pending)
    const p = local ? Promise.resolve(local) : actions().getRide(selected)
    p.then(r => { if (alive) setRide(r) }).catch(() => { if (alive) setRide(null) })
    return () => { alive = false }
  }, [selected, items])

  const head = (
    <div className="ridelisthead">
      <small className="hint">{items.length} {trash ? 'IN TRASH' : items.length === 1 ? 'RIDE' : 'RIDES'}</small>
      {!trash && (
        <span className="pn-viewtoggle">
          <button id="ridesList" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>LIST</button>
          <button id="ridesWeeks" className={view === 'weeks' ? 'active' : ''} onClick={() => setView('weeks')}>WEEKS</button>
        </span>
      )}
      {!riding && window.VBT.storage.listTrash && <button id="ridesTrash" className="ghostbtn" onClick={() => setTrash(t => !t)}>{trash ? '← BACK TO RIDES' : '\u{1F5D1} TRASH'}</button>}
      {riding && <small className="hint" title="Finish your ride to continue, delete or restore rides">READ-ONLY DURING A RIDE</small>}
    </div>
  )
  const detail = ride && <RideDetail ride={ride} readOnly={riding} onDeleted={() => load()} onRestored={id => { setTrash(false); load(id) }} />

  // weekweergave: kalender over de volle breedte, detail vast onderaan (zoals MY PLAN)
  if (view === 'weeks' && !trash) {
    return (
      <div className="pn-section">
        {head}
        <RidesWeeks items={items} selected={selected} onSelect={setSelected} />
        {detail && <div className="pn-sticky">{detail}</div>}
      </div>
    )
  }

  return (
    <div className="pn-section pn-split">
      <div className="ridelistwrap">
        {head}
        <div id="rideList">
          {items.map(r => (
            <button key={r.id} className={'riderow' + (r.id === selected ? ' selected' : '')} onClick={() => setSelected(r.id)}>
              <span className="rdate">{fmtDateTime(r.startedAt)}</span>
              <b>{(r.name || 'Ride').toUpperCase()}<Tags r={r} /></b>
              <span className="rmeta">{fmtDur(r.duration)} · {(r.distance / 1000).toFixed(1)} KM · {r.avgW} W · {r.kj} KJ</span>
            </button>
          ))}
          {!items.length && <p className="pn-hint">{trash ? 'The trash is empty.' : 'No rides yet - every ride you start ends up here, however short.'}</p>}
        </div>
      </div>
      {detail}
    </div>
  )
}
