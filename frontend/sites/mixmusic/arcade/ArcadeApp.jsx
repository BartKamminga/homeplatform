import { useState, useEffect } from 'react'
import { PlayerProvider, usePlayerContext } from '../context/PlayerContext.jsx'
import TrackList from './TrackList.jsx'
import TrackPanel from './TrackPanel.jsx'
import StatsPanel from './StatsPanel.jsx'
import { TransportBar, NowPlayingCard, NowPlayingExpanded } from './Player.jsx'
import { SettingsPanel, GenresPanel, DisplayPanel, ChangelogPanel } from './Panels.jsx'
import { AcTabs } from '@components/arcade/controls.jsx'

// Arcade-variant van Mixmusic (item 1339). Eén desktop- en één mobiele layout (gebaseerd op classic C);
// de player-logica komt ongewijzigd uit PlayerContext.

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const h = e => setMobile(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return mobile
}

function Desktop({ open }) {
  return (
    <div className="mma-desktop">
      <TrackList onOpenSettings={() => open('settings')} onOpenDisplay={() => open('display')} />
      <main className="mma-main"><TrackPanel /></main>
      <TransportBar />
    </div>
  )
}

function Mobile({ open }) {
  const { currentTrack } = usePlayerContext()
  const [view, setView] = useState('tracks')
  useEffect(() => { if (currentTrack) setView('details') }, [currentTrack?.file]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mma-mobile">
      <div className="mma-side-head">
        <span className="ac-logo">♫ MIX</span>
        <button type="button" className="ac-icon" onClick={() => open('settings')} aria-label="Settings">⚙</button>
      </div>
      <NowPlayingCard />
      {currentTrack && (
        <AcTabs className="mma-mobile-tabs" value={view} onChange={setView}
          items={[{ value: 'tracks', label: '♫ TRACKS' }, { value: 'details', label: '✎ DETAILS' }]} />
      )}
      <div className="mma-mobile-body">
        {view === 'tracks' || !currentTrack
          ? <TrackList header={false} onOpenDisplay={() => open('display')} />
          : <TrackPanel />}
      </div>
    </div>
  )
}

function Overlays({ panel, open, close }) {
  const { expandedOpen, setExpandedOpen } = usePlayerContext()
  return (
    <>
      {panel === 'settings' && <SettingsPanel onClose={close} onOpen={open} />}
      {panel === 'stats' && <StatsPanel onClose={close} />}
      {panel === 'genres' && <GenresPanel onClose={() => open('settings')} />}
      {panel === 'display' && <DisplayPanel onClose={close} />}
      {panel === 'changelog' && <ChangelogPanel onClose={() => open('settings')} />}
      {expandedOpen && <NowPlayingExpanded onClose={() => setExpandedOpen(false)} />}
    </>
  )
}

export default function ArcadeApp() {
  const isMobile = useIsMobile()
  const [panel, setPanel] = useState(null)
  const close = () => setPanel(null)
  return (
    <PlayerProvider>
      {isMobile ? <Mobile open={setPanel} /> : <Desktop open={setPanel} />}
      <Overlays panel={panel} open={setPanel} close={close} />
    </PlayerProvider>
  )
}
