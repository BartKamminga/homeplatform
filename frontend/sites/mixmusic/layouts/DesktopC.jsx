import Sidebar             from '../components/Sidebar.jsx'
import TrackPanel          from '../components/TrackPanel.jsx'
import DesktopTransportBar from '../components/DesktopTransportBar.jsx'

export default function DesktopC({ onOpenSettings, onOpenDisplay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar onOpenSettings={onOpenSettings} onOpenDisplay={onOpenDisplay} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TrackPanel />
        </div>
      </div>
      <DesktopTransportBar />
    </div>
  )
}
