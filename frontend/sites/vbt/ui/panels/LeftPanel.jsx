// Linkerpaneel: MENU - door de app lopen, ook tijdens een rit (de rit loopt door).
import NowSection from '../features/now/NowSection.jsx'
import DevicesSection from '../features/devices/DevicesSection.jsx'
import SettingsSection from '../features/settings/SettingsSection.jsx'
import HelpSection from '../features/help/HelpSection.jsx'
import { useVbt, actions } from '../hooks/useVbt.js'

const SECTIONS = [
  { id: 'now', label: 'NOW' },
  { id: 'devices', label: 'DEVICES', key: 'K' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'help', label: 'HELP', key: 'H' },
]

export default function LeftPanel({ section, focus, onSection, onClose, onShowLog }) {
  const riding = useVbt(s => ['ride', 'paused', 'countdown', 'confirm'].includes(s.state))
  return (
    <aside className="vbt-panel vbt-panel-left" aria-label="Menu">
      <header>
        <h3>MENU <em>M</em></h3>
        <button className="pn-close" onClick={onClose} title="Close (Esc)">&#10005;</button>
      </header>
      <nav className="pn-tabs">
        {SECTIONS.map(s => (
          <button key={s.id} className={section === s.id ? 'active' : ''} onClick={() => onSection(s.id)}>
            {s.label}{s.key && <em>{s.key}</em>}
          </button>
        ))}
      </nav>
      <div className="pn-body">
        {section === 'now' && <NowSection />}
        {section === 'devices' && <DevicesSection onShowLog={onShowLog} onHelp={() => onSection('help', 'bluetooth')} />}
        {section === 'settings' && <SettingsSection />}
        {section === 'help' && <HelpSection focus={focus} />}
      </div>
      {!riding && (
        <footer className="pn-footer">
          <button className="ghostbtn" onClick={() => actions().openPlan()}>&#9638; PLAN</button>
          <button className="ghostbtn" onClick={() => actions().openRides()}>&#9776; MY RIDES</button>
        </footer>
      )}
    </aside>
  )
}
