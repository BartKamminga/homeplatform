import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import PlayerBar  from '../components/PlayerBar.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

export default function DesktopA({ onOpenSettings }) {
  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <Sidebar onOpenSettings={onOpenSettings} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TrackPanel />
        </div>

        <div style={{
          width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border)', background: 'var(--bg2)',
          overflow: 'hidden',
        }}>
          <NowPlaying />
          <div style={{ flex: 1, overflowY: 'auto' }} />
        </div>

      </div>
      <PlayerBar />
    </div>
  )
}
