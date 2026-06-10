const s = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '14px 24px', background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    minHeight: 80,
  },
  vinyl: (playing) => ({
    width: 52, height: 52, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
    background: 'conic-gradient(from 0deg, #111 0deg 30deg, #222 30deg 60deg, #111 60deg 90deg, #222 90deg 120deg, #111 120deg 150deg, #222 150deg 180deg, #111 180deg 210deg, #222 210deg 240deg, #111 240deg 270deg, #222 270deg 300deg, #111 300deg 330deg, #222 330deg 360deg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: playing ? '0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
    transition: 'box-shadow 0.3s',
    position: 'relative',
  }),
  vinylLabel: {
    fontSize: 14, zIndex: 1, lineHeight: 1,
  },
  info: { flex: 1, overflow: 'hidden' },
  title: {
    fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700,
    color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.3, marginBottom: 3,
  },
  meta: { fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.04em' },
  empty: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 24px', background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    color: 'var(--muted)', fontSize: 13,
  },
}

import { useState } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function NowPlaying() {
  const { currentTrack: track, playing, togglePlay: onToggle, error, displayName, addHeart, progress } = usePlayerContext()
  const [heartFlash, setHeartFlash] = useState(false)

  function handleHeart() {
    if (!track) return
    addHeart(progress)
    setHeartFlash(true)
    setTimeout(() => setHeartFlash(false), 600)
  }
  if (error) {
    return (
      <div style={s.empty}>
        <span style={{ fontSize: 18 }}>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  if (!track) {
    return (
      <div style={s.empty}>
        <span style={{ fontSize: 24 }}>♫</span>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text)', fontWeight: 700 }}>Mix Music</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>Kies een track in de lijst</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div
        style={s.vinyl(playing)}
        className={playing ? 'spinning' : ''}
        onClick={onToggle}
        title={playing ? 'Pauzeren' : 'Afspelen'}
      >
        <span style={s.vinylLabel}>
          {playing
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </span>
      </div>

      <button
        onClick={handleHeart}
        disabled={!track}
        title={`Markeer favoriet moment${progress ? ` (${formatTime(progress)})` : ''}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
          color: heartFlash ? '#e11d48' : 'var(--muted)',
          transform: heartFlash ? 'scale(1.4)' : 'scale(1)',
          transition: 'transform 0.15s ease, color 0.15s ease',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={heartFlash ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      <div style={s.info}>
        <div style={s.title} title={displayName || track.name}>{displayName || track.name}</div>
        <div style={s.meta}>{track.folder || 'Muziek'} · {track.ext}{displayName ? ` · ${track.name}` : ''}</div>
      </div>
    </div>
  )
}
