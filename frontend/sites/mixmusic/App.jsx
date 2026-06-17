import { useState, useEffect } from 'react'
import { PlayerProvider } from './context/PlayerContext.jsx'
import { useLayout } from './hooks/useLayout.js'
import DesktopC from './layouts/DesktopC.jsx'
import MobileA  from './layouts/MobileA.jsx'
import MobileB  from './layouts/MobileB.jsx'
import MobileC  from './layouts/MobileC.jsx'
import MobileD  from './layouts/MobileD.jsx'
import Settings  from './components/Settings.jsx'
import StatsPage from './components/StatsPage.jsx'

const MOBILE_LAYOUTS = { A: MobileA, B: MobileB, C: MobileC, D: MobileD }

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = e => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statsOpen,    setStatsOpen]    = useState(false)
  const { mobileLayout, setMobileLayout } = useLayout()
  const isMobile = useIsMobile()

  const Layout = isMobile
    ? (MOBILE_LAYOUTS[mobileLayout] ?? MobileC)
    : DesktopC

  return (
    <PlayerProvider>
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          onOpenStats={() => { setSettingsOpen(false); setStatsOpen(true) }}
          mobileLayout={mobileLayout}
          onMobileLayout={setMobileLayout}
          isMobile={isMobile}
        />
      )}
      {statsOpen && <StatsPage onClose={() => setStatsOpen(false)} />}
      <Layout onOpenSettings={() => setSettingsOpen(true)} />
    </PlayerProvider>
  )
}
