// Linkerpaneel: MENU - door de app lopen, ook tijdens een rit (de rit loopt door).
// Trainen: TODAY / MY PLAN / WORKOUTS / MY RIDES / PROGRESS; tijdens een rit staat NOW vooraan.
// Buiten een rit is het paneel breed (VbtApp), tijdens een rit smal.
import NowSection from '../features/now/NowSection.jsx'
import TodaySection from '../features/today/TodaySection.jsx'
import PlanSection from '../features/plan/PlanSection.jsx'
import WorkoutsSection from '../features/workouts/WorkoutsSection.jsx'
import RidesSection from '../features/rides/RidesSection.jsx'
import ProgressSection from '../features/progress/ProgressSection.jsx'
import DevicesSection from '../features/devices/DevicesSection.jsx'
import SettingsSection from '../features/settings/SettingsSection.jsx'
import HelpSection from '../features/help/HelpSection.jsx'

const TRAIN = [
  { id: 'today', label: 'TODAY' },
  { id: 'plan', label: 'MY PLAN', key: 'T' },
  { id: 'workouts', label: 'WORKOUTS' },
  { id: 'rides', label: 'MY RIDES', key: 'R' },
  { id: 'progress', label: 'PROGRESS' },
]
const SETUP = [
  { id: 'devices', label: 'DEVICES', key: 'K' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'help', label: 'HELP', key: 'H' },
]

export default function LeftPanel({ section, focus, riding, width, onSection, onClose, onShowLog }) {
  const tabs = (riding ? [{ id: 'now', label: 'NOW' }] : []).concat(TRAIN)
  const tab = s => (
    <button key={s.id} data-section={s.id} className={section === s.id ? 'active' : ''} onClick={() => onSection(s.id)}>
      {s.label}{s.key && <em>{s.key}</em>}
    </button>
  )
  return (
    <aside className={'vbt-panel vbt-panel-left' + (riding ? '' : ' wide')} style={{ width }} aria-label="Menu">
      <header>
        <h3>MENU <em>M</em></h3>
        <button className="pn-close" onClick={onClose} title="Close (Esc)">&#10005;</button>
      </header>
      <nav className="pn-tabs">
        {tabs.map(tab)}<span className="pn-tabsep" />{SETUP.map(tab)}
      </nav>
      <div className="pn-body">
        {section === 'now' && <NowSection />}
        {section === 'today' && <TodaySection onSection={onSection} />}
        {section === 'plan' && <PlanSection />}
        {section === 'workouts' && <WorkoutsSection />}
        {section === 'rides' && <RidesSection />}
        {section === 'progress' && <ProgressSection />}
        {section === 'devices' && <DevicesSection onShowLog={onShowLog} onHelp={() => onSection('help', 'bluetooth')} />}
        {section === 'settings' && <SettingsSection />}
        {section === 'help' && <HelpSection focus={focus} />}
      </div>
    </aside>
  )
}
