import { usePlayerContext } from '../context/PlayerContext.jsx'
import FractalCanvas from './FractalCanvas.jsx'

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: '#050505',
    display: 'flex', flexDirection: 'column',
  },
  canvasWrap: { position: 'absolute', inset: 0 },
  content: {
    position: 'relative', flex: 1,
    display: 'flex', flexDirection: 'column',
    padding: '20px 24px', color: '#fff',
  },
  closeBtn: {
    alignSelf: 'flex-end', background: 'rgba(255,255,255,0.08)', border: 'none',
    borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
  },
  info: { textAlign: 'center', marginTop: 'auto', textShadow: '0 2px 12px rgba(0,0,0,0.6)' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 13, opacity: 0.75 },
  ctrlRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
    marginTop: 28, marginBottom: 'auto',
  },
  ctrlBtn: (active) => ({
    background: 'none', border: 'none', color: active ? 'var(--accent)' : '#fff',
    cursor: 'pointer', padding: 8, display: 'flex', opacity: active ? 1 : 0.85,
  }),
  playBtn: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'var(--accent)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#050505',
  },
}

export default function NowPlayingExpanded({ onClose }) {
  const {
    currentTrack: track, playing, togglePlay: onToggle, displayName,
    prev: onPrev, next: onNext, shuffle, repeat,
    toggleShuffle: onShuffle, toggleRepeat: onRepeat,
  } = usePlayerContext()

  return (
    <div style={s.overlay}>
      <div style={s.canvasWrap}>
        <FractalCanvas playing={playing} />
      </div>
      <div style={s.content}>
        <button style={s.closeBtn} onClick={onClose} title="Sluiten" aria-label="Sluiten">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {track && (
          <>
            <div style={s.info}>
              <div style={s.title}>{displayName || track.name}</div>
              <div style={s.meta}>{track.folder || 'Muziek'} · {track.ext}{displayName ? ` · ${track.name}` : ''}</div>
            </div>

            <div style={s.ctrlRow}>
              <button style={s.ctrlBtn(shuffle)} onClick={onShuffle} title="Willekeurig">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
                </svg>
              </button>
              <button style={s.ctrlBtn(false)} onClick={onPrev} title="Vorige">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>
              <button style={s.playBtn} onClick={onToggle}>
                {playing
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
              </button>
              <button style={s.ctrlBtn(false)} onClick={onNext} title="Volgende">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
              <button style={s.ctrlBtn(repeat)} onClick={onRepeat} title="Herhalen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
