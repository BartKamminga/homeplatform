import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

export default function DesktopC({ onOpenSettings }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar onOpenSettings={onOpenSettings} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TrackPanel />
        </div>
      </div>
      <NowPlaying />
    </div>
  )
}
