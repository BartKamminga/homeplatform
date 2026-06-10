import { usePlayerContext } from '../context/PlayerContext.jsx'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const s = {
  bar: {
    height: 'var(--bar-h)', background: 'var(--bg2)',
    borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: '20px',
    padding: '0 20px', flexShrink: 0,
    transition: 'background var(--transition)',
  },
  trackInfo: { minWidth: 0, flex: '0 0 190px' },
  trackName: { fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  trackFolder: { fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' },
  controls: { display: 'flex', alignItems: 'center', gap: '14px', flex: 1, justifyContent: 'center' },
  ctrlBtn: (active) => ({
    background: 'none', border: 'none', color: active ? 'var(--accent)' : 'var(--muted)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    padding: '7px', borderRadius: '8px',
  }),
  playBtn: {
    width: '44px', height: '44px', borderRadius: '50%',
    background: 'var(--accent)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--bg)',
  },
  progressArea: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  time: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', minWidth: '36px', whiteSpace: 'nowrap' },
  progressBar: { flex: 1, height: '4px', background: 'var(--bg3)', borderRadius: '2px', cursor: 'pointer', position: 'relative' },
  progressFill: (pct) => ({ height: '100%', background: 'var(--accent)', borderRadius: '2px', width: `${pct}%`, pointerEvents: 'none' }),
  volumeArea: { display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 130px' },
}

export default function PlayerBar() {
  const { currentTrack: track, playing, progress, duration, volume, muted, shuffle, repeat, togglePlay: onToggle, next: onNext, prev: onPrev, seek: onSeek, changeVolume: onVolume, toggleMute: onMute, toggleShuffle: onShuffle, toggleRepeat: onRepeat } = usePlayerContext()
  const pct = duration ? (progress / duration) * 100 : 0

  function handleSeek(e) {
    const bar = e.currentTarget
    const ratio = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth
    onSeek(ratio)
  }

  return (
    <div style={s.bar}>
      {/* Track info */}
      <div style={s.trackInfo}>
        <div style={s.trackName}>{track ? track.name : 'Geen track'}</div>
        <div style={s.trackFolder}>{track ? (track.folder || 'Muziek') : '—'}</div>
      </div>

      {/* Controls */}
      <div style={s.controls}>
        <button style={s.ctrlBtn(shuffle)} onClick={onShuffle} title="Willekeurig">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
        </button>
        <button style={s.ctrlBtn(false)} onClick={onPrev} title="Vorige">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button style={s.playBtn} onClick={onToggle}>
          {playing
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        <button style={s.ctrlBtn(false)} onClick={onNext} title="Volgende">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <button style={s.ctrlBtn(repeat)} onClick={onRepeat} title="Herhalen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div style={s.progressArea}>
        <span style={s.time}>{formatTime(progress)}</span>
        <div style={s.progressBar} onClick={handleSeek}>
          <div style={s.progressFill(pct)} />
        </div>
        <span style={{ ...s.time, textAlign: 'right' }}>{formatTime(duration)}</span>
      </div>

      {/* Volume */}
      <div style={s.volumeArea}>
        <button onClick={onMute} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', opacity: muted ? 0.3 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
        <input
          type="range" min="0" max="100"
          value={Math.round(volume * 100)}
          onChange={e => onVolume(e.target.value / 100)}
          style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}
