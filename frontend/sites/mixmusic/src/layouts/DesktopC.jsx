import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import PlayerBar  from '../components/PlayerBar.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

export default function DesktopC({ onOpenSettings }) {
  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar onOpenSettings={onOpenSettings} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <NowPlaying />
          <TrackPanel />
        </div>
      </div>
      <PlayerBar />
    </div>
  )
}
