// Rechterpaneel: LIVE - telemetrie, events, Bluetooth en backup; logs kopiëren of downloaden.
import TelemetryTab from '../features/live/TelemetryTab.jsx'
import EventsTab from '../features/live/EventsTab.jsx'
import BluetoothTab from '../features/live/BluetoothTab.jsx'
import BackupTab from '../features/live/BackupTab.jsx'
import { actions } from '../hooks/useVbt.js'
import { copyText, downloadText } from '../common/clipboard.js'

const TABS = [
  { id: 'telemetry', label: 'TELEMETRY' },
  { id: 'events', label: 'EVENTS' },
  { id: 'bluetooth', label: 'BLUETOOTH' },
  { id: 'backup', label: 'BACKUP' },
]

export default function RightPanel({ tab, onTab, onClose }) {
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return (
    <aside className="vbt-panel vbt-panel-right" aria-label="Live">
      <header>
        <h3>LIVE <em>L</em></h3>
        <button className="pn-close" onClick={onClose} title="Close (Esc)">&#10005;</button>
      </header>
      <nav className="pn-tabs">
        {TABS.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>{t.label}</button>)}
      </nav>
      <div className="pn-body">
        {tab === 'telemetry' && <TelemetryTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'bluetooth' && <BluetoothTab />}
        {tab === 'backup' && <BackupTab />}
      </div>
      <footer className="pn-footer">
        <button className="ghostbtn" onClick={() => copyText(actions().exportLogs())}>COPY LOGS</button>
        <button className="ghostbtn" onClick={() => downloadText(actions().exportLogs(), 'vbt-logs-' + stamp() + '.json')}>&#11015; DOWNLOAD LOGS</button>
      </footer>
    </aside>
  )
}
