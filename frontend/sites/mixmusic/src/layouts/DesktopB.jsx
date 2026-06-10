import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

export default function DesktopB({ onOpenSettings }) {
  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <NowPlaying />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar onOpenSettings={onOpenSettings} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TrackPanel />
        </div>
      </div>
    </div>
  )
}
