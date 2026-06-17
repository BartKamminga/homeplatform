import { useState, useEffect } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import Sidebar    from '../components/Sidebar.jsx'
import TrackPanel from '../components/TrackPanel.jsx'

function fmtTime(sec) {
  const s = Math.floor(sec || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function MobileD({ onOpenSettings }) {
  const {
    currentTrack, playing, togglePlay, addHeart, progress, duration, displayName,
    muted, toggleMute, volume,
    castAvailable, castConnected, openCastPicker, stopCast,
  } = usePlayerContext()
  const [view, setView]               = useState('tracks')
  const [heartFlash, setHeartFlash]   = useState(false)
  const [searchFocus, setSearchFocus] = useState(0)
  const [searchActive, setSearchActive] = useState(false)

  function handleOpenSearch() {
    const nowActive = !searchActive
    setSearchActive(nowActive)
    if (nowActive) {
      setView('tracks')
      setSearchFocus(n => n + 1)
    }
  }

  // Automatisch naar details als een track wordt gekozen
  useEffect(() => {
    if (currentTrack) setView('details')
  }, [currentTrack?.file])

  // Sluit search als gebruiker naar details gaat
  useEffect(() => {
    if (view === 'details') setSearchActive(false)
  }, [view])

  function handleHeart() {
    if (!currentTrack) return
    addHeart(progress)
    setHeartFlash(true)
    setTimeout(() => setHeartFlash(false), 600)
  }

  const trackName = currentTrack ? (displayName || currentTrack.name) : 'Kies een track'

  return (
    <div style={{ display: 'flex', height: '100dvh', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 16px',
        height: 44, flexShrink: 0,
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800,
          letterSpacing: '-0.5px', color: 'var(--accent)', flex: 1,
        }}>
          ♫ Mix Music
        </span>

        {/* Volume mute toggle */}
        <button
          onClick={toggleMute}
          title={muted ? 'Geluid aan' : 'Geluid uit'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 6, color: muted ? 'var(--border)' : 'var(--muted)', opacity: muted ? 0.5 : 1 }}
        >
          {muted || volume === 0
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
          }
        </button>

        {/* Cast button — alleen als beschikbaar */}
        {castAvailable && (
          <button
            onClick={castConnected ? stopCast : openCastPicker}
            title={castConnected ? 'Cast stoppen' : 'Casten naar apparaat'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 6, color: castConnected ? 'var(--accent)' : 'var(--muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
        )}

        {/* Zoeken */}
        <button
          onClick={handleOpenSearch}
          title="Zoeken in tracks"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 6, color: 'var(--muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 6 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'tracks'
          ? <Sidebar onOpenSettings={onOpenSettings} hideHeader focusSearch={searchFocus} searchVisible={searchActive} />
          : <div style={{ flex: 1, overflowY: 'auto' }}><TrackPanel /></div>
        }
      </div>

      {/* ── Transport bar ── */}
      <div style={{
        height: 56, flexShrink: 0,
        background: 'var(--bg2)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
      }}>

        {/* Play / pause */}
        <button
          onClick={togglePlay}
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)',
          }}
        >
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>

        {/* Hartje + tijd — pill met progress-fill */}
        <button
          onClick={handleHeart}
          disabled={!currentTrack}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            padding: '5px 10px', borderRadius: 20,
            border: `1.5px solid ${heartFlash ? '#e11d48' : '#e11d4866'}`,
            background: 'rgba(225,29,72,0.05)',
            cursor: currentTrack ? 'pointer' : 'default',
            transform: heartFlash ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Progress fill — achtergrond vult mee met afgespeeld percentage */}
          {!heartFlash && duration > 0 && (
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${(progress / duration) * 100}%`,
              background: 'rgba(225,29,72,0.28)',
              pointerEvents: 'none',
            }} />
          )}
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={heartFlash ? '#e11d48' : 'none'}
            stroke="#e11d48" strokeWidth="2.5"
            style={{ position: 'relative' }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#e11d48', lineHeight: 1, position: 'relative' }}>
            {fmtTime(progress)}
          </span>
        </button>

        {/* Track naam */}
        <div style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 13, fontWeight: 600,
          color: currentTrack ? 'var(--text)' : 'var(--muted)',
        }}>
          {trackName}
        </div>

        {/* View toggle pill */}
        <div style={{
          display: 'flex', borderRadius: 8,
          border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0,
        }}>
          {[['tracks', '♫'], ['details', '✎']].map(([v, icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 12px', border: 'none', cursor: 'pointer',
                fontSize: 14,
                background: view === v ? 'var(--accent)' : 'var(--bg3)',
                color: view === v ? '#fff' : 'var(--muted)',
              }}
            >
              {icon}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
