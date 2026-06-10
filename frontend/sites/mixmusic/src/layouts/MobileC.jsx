import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import PlayerBar  from '../components/PlayerBar.jsx'
import TrackPanel from '../components/TrackPanel.jsx'
import { usePlayerContext } from '../context/PlayerContext.jsx'

export default function MobileC({ onOpenSettings }) {
  const { currentTrack } = usePlayerContext()

  return (
    <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
      {currentTrack ? (
        <>
          <NowPlaying />
          <div style={{ flex: 1, overflowY: 'auto' }}><TrackPanel /></div>
        </>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Sidebar onOpenSettings={onOpenSettings} />
        </div>
      )}
      <PlayerBar />
    </div>
  )
}
