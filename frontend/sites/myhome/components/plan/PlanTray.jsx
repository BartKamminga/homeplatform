import { useState } from 'react'
import { DEVICE_KINDS, QUICK_ADD, SymbolIcon } from './symbols.jsx'

// Zijlade in plaatsmodus: nieuwe voorzieningen (stroom, internet, ...) en nog niet geplaatste apparaten.
export default function PlanTray({ toPlace, armed, onArm }) {
  const [q, setQ] = useState('')
  const isArmed = (item) => armed && (armed.quickAdd ? armed.quickAdd === item.quickAdd : armed.id === item.id)
  const list = toPlace.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="mh-tray">
      <p className="mh-muted">Pick something, then click on the plan. The room is set from where you drop it.</p>
      <h3>Add to the plan</h3>
      <div className="mh-chips">
        {QUICK_ADD.map((k) => {
          const item = { quickAdd: k }
          return (
            <button key={k} id={`qa-${k}`} className={`mh-chip ${isArmed(item) ? 'on' : ''}`} onClick={() => onArm(isArmed(item) ? null : item)}>
              <SymbolIcon kind={k} size={18} /> {DEVICE_KINDS[k].label}
            </button>
          )
        })}
      </div>
      <h3>Not on the plan yet · {toPlace.length}</h3>
      <input id="tray-search" placeholder="Search devices" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search devices" />
      <ul className="mh-tray-list">
        {list.slice(0, 200).map((d) => (
          <li key={d.id}>
            <button className={isArmed(d) ? 'on' : ''} onClick={() => onArm(isArmed(d) ? null : d)}>
              <SymbolIcon kind={d.kind} size={18} />
              <span>{d.name}{d.meta?.review === 'new' && <em> new</em>}</span>
              <small>{d.roomName || 'no room'}</small>
            </button>
          </li>
        ))}
        {!list.length && <li className="mh-muted">Everything is placed.</li>}
      </ul>
    </div>
  )
}
