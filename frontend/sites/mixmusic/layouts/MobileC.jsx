import { useState, useEffect } from 'react'
import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import TrackPanel from '../components/TrackPanel.jsx'
import { usePlayerContext } from '../context/PlayerContext.jsx'

export default function MobileC({ onOpenSettings }) {
  const { currentTrack } = usePlayerContext()
  const [view, setView] = useState('tracks')

  useEffect(() => {
    if (currentTrack) setView('details')
  }, [currentTrack?.file])

  if (!currentTrack) {
    return (
      <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
        <Sidebar onOpenSettings={onOpenSettings} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
      <NowPlaying />

      {/* Toggle — zelfde stijl als MobileD */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0,
      }}>
        {[['tracks', '♫ Tracks'], ['details', '✎ Details']].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: view === v ? 600 : 400,
              background: view === v ? 'var(--accent)18' : 'transparent',
              color: view === v ? 'var(--accent)' : 'var(--muted)',
              borderBottom: view === v ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'tracks'
          ? <Sidebar onOpenSettings={onOpenSettings} hideHeader />
          : <div style={{ flex: 1, overflowY: 'auto' }}><TrackPanel /></div>
        }
      </div>
    </div>
  )
}
