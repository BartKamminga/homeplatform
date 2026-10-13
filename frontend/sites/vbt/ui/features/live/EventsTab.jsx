// EVENTS: tijdlijn van alles wat de engine logt (intervallen, pauzes, Bluetooth, backup, outbox, opslaan).
import { useState } from 'react'
import { useVbtEvents } from '../../hooks/useVbt.js'
import { fmtDur } from '../../common/format.js'

const TYPES = ['all', 'interval', 'pause', 'resume', 'ble', 'backup', 'outbox', 'save', 'jump', 'lap']

export default function EventsTab() {
  const events = useVbtEvents()
  const [type, setType] = useState('all')
  const [debug, setDebug] = useState(false)
  const shown = events
    .filter(e => (type === 'all' || e.type === type) && (debug || e.level !== 'debug'))
    .slice(-200).reverse()

  return (
    <div className="pn-section">
      <div className="pn-filter">
        <select value={type} onChange={e => setType(e.target.value)}>
          {TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <label><input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} /> backup ticks</label>
        <span className="pn-hint">{events.length} events</span>
      </div>
      <ol className="pn-events">
        {shown.map(e => (
          <li key={e.id} data-level={e.level}>
            <time>{new Date(e.t).toTimeString().slice(0, 8)}</time>
            <span className="pn-type" data-type={e.type}>{e.type}</span>
            <span className="pn-msg">{e.msg}</span>
            {e.rideTime > 0 && <em>{fmtDur(e.rideTime)}</em>}
          </li>
        ))}
        {!shown.length && <li className="pn-hint">Nothing logged yet.</li>}
      </ol>
    </div>
  )
}
