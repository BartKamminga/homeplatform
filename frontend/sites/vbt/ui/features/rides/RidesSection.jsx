// MY RIDES: alle ritten (ook nog niet gesynchroniseerde), detail met grafiek, pauzes, eventlog,
// .FIT, CONTINUE RIDE en prullenbak (terugzetten). Als lijst of per week (RidesWeeks).
import { useCallback, useEffect, useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { actions } from '../../hooks/useVbt.js'
import { fmtDur, fmtDateTime, startWithConfirm } from '../../common/format.js'
import { confirmDialog } from '../../common/ConfirmDialog.jsx'
import { drawRide } from './rideChart.js'
import RidesWeeks from './RidesWeeks.jsx'

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
      {r.kind === 'workout' && <i className="tag wo">WORKOUT</i>}
      {r.kind === 'climb' && <i className="tag wo">CLIMB</i>}
      {r.stravaActivityId && <i className="tag strava">STRAVA</i>}
    </>
  )
}

function RideDetail({ ride, onDeleted, onRestored }) {
  const stat = (v, l) => <div key={l}><b>{v}</b><small>{l}</small></div>
  const paused = Math.max(0, (ride.elapsed || 0) - ride.duration)
  const remove = async () => {
    if (!(await confirmDialog({ title: 'MOVE TO TRASH?', text: 'Ride of ' + fmtDateTime(ride.startedAt) + '. You can restore it from TRASH.', yes: 'DELETE', danger: true }))) return
    try { await actions().deleteRide(ride.id); onDeleted() } catch (e) { window.VBT.toast?.(e.message, 6000) }
  }
  const restore = async () => {
    try { await window.VBT.storage.restoreRide(ride.id); window.VBT.toast?.('RIDE RESTORED'); onRestored(ride.id) } catch (e) { window.VBT.toast?.(e.message, 6000) }
  }
  const canContinue = !!(ride.clientId && ride.samples && ride.samples.length)
  return (
    <div id="rideDetail" className="pn-detail">
      <div className="dhead">
        <div>
          <small>{fmtDateTime(ride.startedAt)}{ride.jumped ? ' · INTERVALS SKIPPED' : ''}</small>
          <h3>{(ride.name || 'Ride').toUpperCase()}</h3>
        </div>
      </div>
      <div className="pn-buttons">
        {ride.deletedAt
          ? <button id="rideRestore" className="ridebtn" onClick={restore}>&#8634; RESTORE</button>
          : !ride.pending && <button id="rideDelete" className="ghostbtn" onClick={remove}>DELETE</button>}
        <button id="rideFit" className="ghostbtn" disabled={!(ride.samples && ride.samples.length)} onClick={() => actions().downloadFit(ride)}>&#11015; .FIT</button>
        {!ride.deletedAt && <button id="rideContinue" className="ridebtn" disabled={!canContinue}
          onClick={() => startWithConfirm('this ride again', () => actions().resumeRide(ride))}>CONTINUE RIDE &#9654;</button>}
      </div>
      <div className="ridestats">
        {stat(fmtDur(ride.duration), 'TIME')}{stat((ride.distance / 1000).toFixed(2), 'KM')}{stat(ride.avgW, 'AVG W')}
        {stat(ride.maxW, 'MAX W')}{stat(ride.kj, 'KJ')}{stat(ride.avgCad, 'AVG RPM')}{stat(ride.avgHr || '-', 'AVG BPM')}
        {stat(ride.elevation, 'M UP')}
        {ride.elapsed ? <>{stat(fmtDur(ride.elapsed), 'ELAPSED')}{stat(fmtDur(paused), 'PAUSED')}</> : null}
        {ride.lapTime ? stat(fmtDur(ride.lapTime), ride.kind === 'climb' ? 'TO THE TOP' : 'BEST LAP') : null}
        {ride.score !== null && ride.score !== undefined ? stat(ride.score + '%', 'CADENCE') : null}
      </div>
      <CanvasChart height={160} draw={(ctx, w, h) => drawRide(ctx, w, h, ride.samples)} />
      <div className="ridelogs">
        {!!(ride.pauses && ride.pauses.length) && (
          <details open><summary>PAUSES ({ride.pauses.length})</summary>
            <ul>{ride.pauses.map((p, i) => <li key={i}>{fmtDur(p.t)} · {p.reason} · {fmtDur(p.dur)}</li>)}</ul></details>)}
        {!!(ride.events && ride.events.length) && (
          <details><summary>EVENT LOG ({ride.events.length})</summary>
            <ul className="rideevents">{ride.events.map((e, i) => (
              <li key={i} data-level={e.level}><i>{new Date(e.t).toTimeString().slice(0, 8)}</i> {e.type} · {e.msg}</li>))}</ul></details>)}
      </div>
    </div>
  )
}

export default function RidesSection() {
  const [trash, setTrash] = useState(false)
  const [view, setViewState] = useState(readView)
  const setView = v => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* geen opslag */ } }
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [ride, setRide] = useState(null)

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
      {window.VBT.storage.listTrash && <button id="ridesTrash" className="ghostbtn" onClick={() => setTrash(t => !t)}>{trash ? '← BACK TO RIDES' : '\u{1F5D1} TRASH'}</button>}
    </div>
  )
  const detail = ride && <RideDetail ride={ride} onDeleted={() => load()} onRestored={id => { setTrash(false); load(id) }} />

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
