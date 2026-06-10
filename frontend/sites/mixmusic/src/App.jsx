import { useState, useEffect } from 'react'
import { PlayerProvider } from './context/PlayerContext.jsx'
import { useLayout } from './hooks/useLayout.js'
import DesktopA from './layouts/DesktopA.jsx'
import DesktopB from './layouts/DesktopB.jsx'
import DesktopC from './layouts/DesktopC.jsx'
import MobileA  from './layouts/MobileA.jsx'
import MobileB  from './layouts/MobileB.jsx'
import MobileC  from './layouts/MobileC.jsx'
import Settings from './components/Settings.jsx'

const DESKTOP_LAYOUTS = { A: DesktopA, B: DesktopB, C: DesktopC }
const MOBILE_LAYOUTS  = { A: MobileA,  B: MobileB,  C: MobileC  }

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
  const { desktopLayout, mobileLayout, setDesktopLayout, setMobileLayout } = useLayout()
  const isMobile = useIsMobile()

  const Layout = isMobile
    ? (MOBILE_LAYOUTS[mobileLayout] ?? MobileC)
    : (DESKTOP_LAYOUTS[desktopLayout] ?? DesktopC)

  return (
    <PlayerProvider>
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          desktopLayout={desktopLayout}
          mobileLayout={mobileLayout}
          onDesktopLayout={setDesktopLayout}
          onMobileLayout={setMobileLayout}
        />
      )}
      <Layout onOpenSettings={() => setSettingsOpen(true)} />
    </PlayerProvider>
  )
}
