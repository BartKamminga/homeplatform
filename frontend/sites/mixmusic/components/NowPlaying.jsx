import { useState } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'

const s = {
  wrap: {
    background: 'var(--bg2)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  topRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 20px 6px',
  },
  vinyl: (playing) => ({
    width: 48, height: 48, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
    background: 'conic-gradient(from 0deg, #111 0deg 30deg, #222 30deg 60deg, #111 60deg 90deg, #222 90deg 120deg, #111 120deg 150deg, #222 150deg 180deg, #111 180deg 210deg, #222 210deg 240deg, #111 240deg 270deg, #222 270deg 300deg, #111 300deg 330deg, #222 330deg 360deg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: playing ? '0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
    transition: 'box-shadow 0.3s', position: 'relative',
  }),
  info: { flex: 1, overflow: 'hidden' },
  title: {
    fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700,
    color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.3, marginBottom: 2,
  },
  meta: { fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.04em' },
  ctrlRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '4px 20px 10px',
  },
  ctrlBtn: (active) => ({
    background: 'none', border: 'none',
    color: active ? 'var(--accent)' : 'var(--muted)',
    cursor: 'pointer', padding: '7px', borderRadius: '8px',
    display: 'flex', alignItems: 'center',
  }),
  playBtn: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'var(--accent)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--bg)', flexShrink: 0,
  },
  volumeArea: {
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  empty: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 20px', background: 'var(--bg2)',
    borderTop: '1px solid var(--border)',
    color: 'var(--muted)', fontSize: 13,
  },
}

export default function NowPlaying() {
  const {
    currentTrack: track, playing, togglePlay: onToggle, error, displayName, addHeart, progress,
    prev: onPrev, next: onNext, shuffle, repeat,
    toggleShuffle: onShuffle, toggleRepeat: onRepeat,
    volume, muted, changeVolume: onVolume, toggleMute: onMute,
    castAvailable, castConnected, openCastPicker, stopCast,
  } = usePlayerContext()
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
      {/* Rij 1: vinyl · hart · info · volume */}
      <div style={s.topRow}>
        <div
          style={s.vinyl(playing)}
          className={playing ? 'spinning' : ''}
          onClick={onToggle}
          title={playing ? 'Pauzeren' : 'Afspelen'}
        >
          <span style={{ fontSize: 13, zIndex: 1 }}>
            {playing
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </span>
        </div>

        <button
          onClick={handleHeart}
          title="Markeer favoriet moment"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
            color: heartFlash ? '#e11d48' : 'var(--muted)',
            transform: heartFlash ? 'scale(1.4)' : 'scale(1)',
            transition: 'transform 0.15s ease, color 0.15s ease',
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={heartFlash ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        <div style={s.info}>
          <div style={s.title} title={displayName || track.name}>{displayName || track.name}</div>
          <div style={s.meta}>{track.folder || 'Muziek'} · {track.ext}{displayName ? ` · ${track.name}` : ''}</div>
        </div>

        <div style={s.volumeArea}>
          <button
            onClick={onMute}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', opacity: muted ? 0.35 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <input
            type="range" min="0" max="100"
            value={muted ? 0 : Math.round(volume * 100)}
            onChange={e => onVolume(e.target.value / 100)}
            style={{ width: 80, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          {castAvailable && (
            <button
              onClick={castConnected ? stopCast : openCastPicker}
              title={castConnected ? 'Cast stoppen' : 'Casten naar apparaat'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                display: 'flex', alignItems: 'center',
                color: castConnected ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Rij 2: transport controls */}
      <div style={s.ctrlRow}>
        <button style={s.ctrlBtn(shuffle)} onClick={onShuffle} title="Willekeurig">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
        </button>
        <button style={s.ctrlBtn(false)} onClick={onPrev} title="Vorige">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button style={s.playBtn} onClick={onToggle}>
          {playing
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        <button style={s.ctrlBtn(false)} onClick={onNext} title="Volgende">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <button style={s.ctrlBtn(repeat)} onClick={onRepeat} title="Herhalen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
