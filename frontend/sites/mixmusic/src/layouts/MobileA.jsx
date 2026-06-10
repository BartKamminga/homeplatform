import { useState } from 'react'
import Sidebar    from '../components/Sidebar.jsx'
import NowPlaying from '../components/NowPlaying.jsx'
import PlayerBar  from '../components/PlayerBar.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

const TABS = [
  { key: 'tracks',   label: 'Tracks',  icon: '♫' },
  { key: 'playing',  label: 'Speelt',  icon: '▶' },
  { key: 'details',  label: 'Details', icon: '✎' },
]

export default function MobileA({ onOpenSettings }) {
  const [tab, setTab] = useState('tracks')

  return (
    <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'tracks'  && <Sidebar onOpenSettings={onOpenSettings} />}
        {tab === 'playing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <NowPlaying />
            <TrackPanel />
          </div>
        )}
        {tab === 'details' && (
          <div style={{ flex: 1, overflowY: 'auto' }}><TrackPanel /></div>
        )}
      </div>

      <PlayerBar />

      <div style={{
        display: 'flex', borderTop: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-body)',
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
