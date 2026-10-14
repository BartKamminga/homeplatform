import { usePlayerContext } from '../context/PlayerContext.jsx'
import HeartsBar from './HeartsBar.jsx'
import SynthSun from './SynthSun.jsx'
import { fmtTime } from './format.js'

// Speler-onderdelen (item 1339): knoppen, volume-LEDs, desktop-transportbalk, mobiele HUD-kaart en het
// uitgeklapte "now playing"-scherm.

export function Buttons({ big = false }) {
  const { playing, togglePlay, prev, next, shuffle, repeat, toggleShuffle, toggleRepeat } = usePlayerContext()
  const size = big ? { width: 62, height: 62, fontSize: 20 } : undefined
  return (
    <div className="mma-btns">
      <button type="button" className={`ac-icon${shuffle ? ' on' : ''}`} onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Shuffle">⇄</button>
      <button type="button" className="ac-icon" onClick={prev} aria-label="Previous">⏮</button>
      <button type="button" className="ac-play" style={size} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
      <button type="button" className="ac-icon" onClick={next} aria-label="Next">⏭</button>
      <button type="button" className={`ac-icon${repeat ? ' on' : ''}`} onClick={toggleRepeat} aria-pressed={repeat} aria-label="Repeat">↻</button>
    </div>
  )
}

function Volume() {
  const { volume, muted, changeVolume, toggleMute } = usePlayerContext()
  const level = muted ? 0 : Math.round(volume * 12)
  return (
    <div className="mma-vol">
      <button type="button" className={`ac-icon${muted ? '' : ' on'}`} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '✕' : '◀)'}</button>
      <div className="mma-vol-leds" role="slider" aria-label="Volume" aria-valuemin={0} aria-valuemax={12} aria-valuenow={level}>
        {Array.from({ length: 12 }, (_, i) => (
          <button key={i} type="button" tabIndex={-1} aria-label={`Volume ${i + 1}`}
            className={i < level ? `on${i >= 10 ? ' p' : i >= 7 ? ' y' : ''}` : ''} onClick={() => changeVolume((i + 1) / 12)} />
        ))}
      </div>
    </div>
  )
}

function Cast() {
  const { castAvailable, castConnected, openCastPicker, stopCast } = usePlayerContext()
  if (!castAvailable) return null
  return (
    <button type="button" className={`ac-btn ac-btn--sm${castConnected ? ' on' : ' ac-btn--cyan'}`} onClick={castConnected ? stopCast : openCastPicker}>
      {castConnected ? 'STOP CAST' : 'CAST'}
    </button>
  )
}

function Seek() {
  const { progress, duration, seek, hearts } = usePlayerContext()
  return (
    <div className="mma-seek">
      <span>{fmtTime(progress)}</span>
      <HeartsBar hearts={hearts} duration={duration} progress={progress} onSeek={seek} />
      <span>{fmtTime(duration)}</span>
    </div>
  )
}

export function TransportBar() {
  const { currentTrack: track, displayName, error, playing, addHeart, progress, setExpandedOpen } = usePlayerContext()
  if (error) return <div className="mma-bar"><span className="ac-label" style={{ color: 'var(--ac-pink)', margin: 0 }}>⚠ {error}</span></div>
  return (
    <div className="mma-bar">
      <button type="button" className="mma-np" onClick={() => track && setExpandedOpen(true)} disabled={!track} title="Full screen">
        <SynthSun className="mma-cover sm" playing={playing} width={84} height={84} />
        <span style={{ minWidth: 0 }}>
          <b>{track ? (displayName || track.name) : 'MIX MUSIC'}</b>
          <small>{track ? `${(track.folder || 'MUSIC').toUpperCase()} · ${track.ext?.toUpperCase()}` : 'PICK A TRACK'}</small>
        </span>
      </button>
      <div className="mma-transport"><Buttons /><Seek /></div>
      <div className="mma-side-ctl">
        {track && <button type="button" className="ac-btn ac-btn--sm ac-btn--danger" onClick={() => addHeart(progress)} title="Mark a favourite moment">♥ {fmtTime(progress)}</button>}
        <Volume />
        <Cast />
      </div>
    </div>
  )
}

export function NowPlayingCard() {
  const { currentTrack: track, displayName, playing, togglePlay, setExpandedOpen } = usePlayerContext()
  if (!track) return null
  return (
    <div className="ac-hud mma-npcard">
      <div className="top">
        <button type="button" className="mma-np" onClick={() => setExpandedOpen(true)}>
          <SynthSun className="mma-cover sm" playing={playing} width={96} height={96} />
          <span style={{ minWidth: 0 }}><b>{displayName || track.name}</b><small>{(track.folder || 'MUSIC').toUpperCase()}</small></span>
        </button>
        <button type="button" className="ac-play" style={{ width: 40, height: 40 }} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
      </div>
      <Seek />
    </div>
  )
}

export function NowPlayingExpanded({ onClose }) {
  const { currentTrack: track, displayName, playing, meta, hearts, addHeart, progress } = usePlayerContext()
  return (
    <div className="mma-expanded" role="dialog" aria-label="Now playing">
      <div className="mma-expanded-head">
        <button type="button" className="ac-icon" onClick={onClose} aria-label="Close">▾</button>
        <span className="ac-label" style={{ margin: 0 }}>NOW PLAYING</span>
        <Cast />
      </div>
      <SynthSun grid playing={playing} className="mma-expanded-sun" width={700} height={630} />
      {track && <>
        <h2>{displayName || track.name}</h2>
        <div className="mma-tagline">{(track.folder || 'MUSIC').toUpperCase()}{meta.rating ? ` · RATED ${meta.rating}` : ''}{hearts.length ? ` · ♥ ${hearts.length}` : ''}</div>
        <Seek />
        <div className="mma-expanded-ctl">
          <Buttons big />
          <button type="button" className="ac-icon" style={{ color: 'var(--ac-pink)', borderColor: 'var(--ac-pink)' }} onClick={() => addHeart(progress)} aria-label="Mark a favourite moment">♥</button>
        </div>
      </>}
    </div>
  )
}
