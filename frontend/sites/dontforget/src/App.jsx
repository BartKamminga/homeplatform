import { useState, useEffect } from 'react'
import TodayPage from './pages/TodayPage.jsx'
import RoutinesPage from './pages/RoutinesPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AddTask from './pages/AddTask.jsx'
import TabBar from './components/TabBar.jsx'
import { getActiveTheme } from '@core/api.js'

export default function App() {
  const [tab, setTab]       = useState('today')
  const [adding, setAdding] = useState(false)
  const [theme, setTheme]   = useState(getActiveTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  if (adding) return <AddTask onClose={() => setAdding(false)} />

  return (
    <div key={theme} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'today'    && <TodayPage onAdd={() => setAdding(true)} />}
        {tab === 'routines' && <RoutinesPage onAdd={() => setAdding(true)} />}
        {tab === 'history'  && <HistoryPage />}
        {tab === 'settings' && <SettingsPage />}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
