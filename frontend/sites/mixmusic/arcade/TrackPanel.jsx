import { useState, useEffect, useRef } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import HeartsBar from './HeartsBar.jsx'
import SynthSun from './SynthSun.jsx'
import { MOMENTS, ratingColor, genreColor, fmtTime, fmtDuration } from './format.js'

// Details van de huidige track (item 1339): naam, genres, LED-rating, hartjes, momenten, beheer.
export default function TrackPanel() {
  const {
    currentTrack: track, meta, metaLoading, handleMetaChange, genres, hearts, pendingHearts, addHeart, removeHeart,
    seek, duration, progress, isAdmin, toggleExcluded, playing,
  } = usePlayerContext()
  const [name, setName] = useState('')
  const timer = useRef(null)

  useEffect(() => { setName(meta.display_name || '') }, [track?.file, meta.display_name])

  if (!track) return (
    <div className="ac-state mma-empty">
      <div className="ac-big-msg">INSERT<br />TRACK</div>
      <p className="ac-hint">Pick a track from the list to start playing.</p>
    </div>
  )
  if (metaLoading) return <div className="ac-state"><span className="ac-label ac-blink">LOADING…</span></div>

  const activeGenres = meta.genres ?? []
  const activeMoments = meta.moments ?? []
  const rating = meta.rating ?? 0
  const rc = ratingColor(rating)
  const toggle = (list, key, field) => handleMetaChange({ [field]: list.includes(key) ? list.filter(x => x !== key) : [...list, key] })

  function onName(e) {
    const v = e.target.value
    setName(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => handleMetaChange({ display_name: v || null }), 400)
  }

  return (
    <div className="mma-panel">
      <div className="mma-title">
        <SynthSun className="mma-cover" playing={playing} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <label className="ac-label" htmlFor="mma-name">Name</label>
          <input id="mma-name" className="ac-input mma-name" value={name} onChange={onName} placeholder={track.name} />
          <p className="mma-sub">
            {name && name !== track.name ? `${track.name} · ` : ''}{track.ext?.toUpperCase()}
            {meta.play_count > 0 && <span style={{ color: 'var(--ac-pink)' }}> · PLAYED {meta.play_count}×{meta.play_seconds > 0 ? ` · ${fmtDuration(meta.play_seconds)}` : ''}</span>}
          </p>
        </div>
      </div>

      <div>
        <span className="ac-label">Genre</span>
        <div className="mma-chips">
          {genres.map(g => (
            <button key={g.id} type="button" className={`mma-chip${activeGenres.includes(g.name) ? ' on' : ''}`} style={{ '--c': genreColor(genres, g.name) }}
              onClick={() => toggle(activeGenres, g.name, 'genres')}>{g.name.toUpperCase()}</button>
          ))}
          {!genres.length && <span className="ac-hint">Add genres in Settings.</span>}
        </div>
      </div>

      <div>
        <span className="ac-label">Rating {rating > 0 && <span style={{ color: rc }}>{rating}/10</span>}</span>
        <div className="mma-rating">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" aria-label={`Rate ${n}`} aria-pressed={n <= rating}
              style={n <= rating ? { background: rc, color: 'var(--ac-bg)', borderColor: rc, boxShadow: `0 0 8px ${rc}` } : undefined}
              onClick={() => handleMetaChange({ rating: n === rating ? null : n })}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="mma-row-head">
          <span className="ac-label" style={{ margin: 0 }}>Favourite moments{hearts.length ? ` · ${hearts.length}×` : ''}</span>
          {duration > 0 && <button type="button" className="ac-btn ac-btn--sm ac-btn--danger" onClick={() => addHeart(progress)}>♥ {fmtTime(progress)}</button>}
        </div>
        <HeartsBar tall hearts={hearts} pending={pendingHearts} duration={duration} progress={progress} onSeek={seek} onRemove={removeHeart} />
        <div className="mma-times"><span>0:00</span><span>{fmtTime(duration)}</span></div>
      </div>

      <div>
        <span className="ac-label">When does it sound good?</span>
        <div className="mma-moments">
          {MOMENTS.map(m => (
            <button key={m.key} type="button" aria-pressed={activeMoments.includes(m.key)} className={activeMoments.includes(m.key) ? 'on' : ''}
              style={{ flex: m.flex, '--c': m.color }} onClick={() => toggle(activeMoments, m.key, 'moments')}>
              <b>{m.label}</b><small>{m.hours}</small>
            </button>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div>
          <span className="ac-label">Admin</span>
          <button type="button" className={`ac-btn ac-btn--sm${meta.excluded ? ' ac-btn--fill-danger' : ' ac-btn--danger'}`}
            onClick={() => toggleExcluded(track.file, !meta.excluded)}>
            {meta.excluded ? '⊘ HIDDEN FROM TRACKLIST' : '○ HIDE FROM TRACKLIST'}
          </button>
          {meta.excluded && <p className="ac-hint" style={{ marginTop: 6 }}>Other users don't see this track. You see it marked.</p>}
        </div>
      )}
    </div>
  )
}
