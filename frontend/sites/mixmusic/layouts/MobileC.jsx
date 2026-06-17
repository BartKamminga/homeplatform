import { useState, useEffect } from 'react'
import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import TrackPanel from '../components/TrackPanel.jsx'
import { usePlayerContext } from '../context/PlayerContext.jsx'

export default function MobileC({ onOpenSettings, onOpenDisplay }) {
  const { currentTrack } = usePlayerContext()
  const [view, setView] = useState('tracks')

  useEffect(() => {
    if (currentTrack) setView('details')
  }, [currentTrack?.file])

  if (!currentTrack) {
    return (
      <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
        <Sidebar onOpenSettings={onOpenSettings} onOpenDisplay={onOpenDisplay} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>
      <NowPlaying />

      {/* Toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)',
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
        <button
          onClick={onOpenSettings}
          title="Instellingen"
          style={{
            background: 'none', border: 'none', borderBottom: '2px solid transparent',
            color: 'var(--muted)', cursor: 'pointer', padding: '8px 12px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'tracks'
          ? <Sidebar onOpenSettings={onOpenSettings} hideHeader onOpenDisplay={onOpenDisplay} />
          : <div style={{ flex: 1, overflowY: 'auto' }}><TrackPanel /></div>
        }
      </div>
    </div>
  )
}
