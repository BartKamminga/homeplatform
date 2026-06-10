import { useState, useEffect } from 'react'
import TodayPage from './pages/TodayPage.jsx'
import RoutinesPage from './pages/RoutinesPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AddTask from './pages/AddTask.jsx'
import TabBar from './components/TabBar.jsx'
import { getActiveTheme } from '@core/api.js'

// editTask: undefined = gesloten, null = nieuw, object = bewerken
export default function App() {
  const [tab,        setTab]        = useState('today')
  const [editTask,   setEditTask]   = useState(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [theme,      setTheme]      = useState(getActiveTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  if (editTask !== undefined) {
    return (
      <AddTask
        task={editTask}
        onClose={() => setEditTask(undefined)}
        onSaved={() => { setEditTask(undefined); setRefreshKey(k => k + 1) }}
      />
    )
  }

  return (
    <div key={theme} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'today'    && <TodayPage onAdd={() => setEditTask(null)} onEdit={setEditTask} refreshKey={refreshKey} />}
        {tab === 'routines' && <RoutinesPage onAdd={() => setEditTask(null)} onEdit={setEditTask} refreshKey={refreshKey} />}
        {tab === 'history'  && <HistoryPage />}
        {tab === 'settings' && <SettingsPage />}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
