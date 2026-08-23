import { useState } from 'react'
import * as s from './styles.js'
import AgentsView from './AgentsView.jsx'
import ContextsView from './ContextsView.jsx'
import TasksView from './TasksView.jsx'
import NotificationsView from './NotificationsView.jsx'
import LogView from './LogView.jsx'

const NAV = [
  { key: 'agents', label: 'Agents', View: AgentsView },
  { key: 'contexts', label: 'Contexten', View: ContextsView },
  { key: 'tasks', label: 'Opdrachten', View: TasksView },
  { key: 'notifications', label: 'Meldingen', View: NotificationsView },
  { key: 'log', label: 'Log', View: LogView },
]

export default function App() {
  const [tab, setTab] = useState('agents')
  const [error, setError] = useState(null)

  const Active = NAV.find(n => n.key === tab).View

  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={s.sidebarTitle}>Agent Control</div>
        <div style={s.sidebarSub}>HomePlatform</div>
        {NAV.map(n => (
          <div key={n.key} style={s.navItem(tab === n.key)} onClick={() => { setTab(n.key); setError(null) }}>
            {n.label}
          </div>
        ))}
      </div>
      <div style={s.main}>
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <Active onError={setError} />
      </div>
    </div>
  )
}
