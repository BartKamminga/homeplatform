import { useState } from 'react'
import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import PlayerBar  from '../components/PlayerBar.jsx'
import TrackPanel from '../components/TrackPanel.jsx'
import { usePlayerContext } from '../context/PlayerContext.jsx'

export default function MobileB({ onOpenSettings }) {
  const { currentTrack } = usePlayerContext()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Sidebar onOpenSettings={onOpenSettings} />
      </div>

      <PlayerBar />

      {currentTrack && (
        <>
          {sheetOpen && (
            <div
              onClick={() => setSheetOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20 }}
            />
          )}

          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
            background: 'var(--bg)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0',
            transform: sheetOpen ? 'translateY(0)' : 'translateY(calc(100% - 70px))',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            <div
              onClick={() => setSheetOpen(s => !s)}
              style={{ padding: '8px 16px 0', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 6px' }} />
              <NowPlaying />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', opacity: sheetOpen ? 1 : 0, transition: 'opacity 0.2s' }}>
              <TrackPanel />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
