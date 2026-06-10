import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

export default function DesktopC({ onOpenSettings }) {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar onOpenSettings={onOpenSettings} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <NowPlaying />
        <TrackPanel />
      </div>
    </div>
  )
}
