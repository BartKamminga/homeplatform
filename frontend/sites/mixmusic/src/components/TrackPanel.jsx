import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import { SkeletonLine, SkeletonBlock } from '@components/Skeleton.jsx'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const MOMENTS = [
  { key: 'morning',   label: 'Ochtend', hours: '06–12', flex: 6, color: '#f59e0b' },
  { key: 'afternoon', label: 'Middag',  hours: '12–18', flex: 6, color: '#10b981' },
  { key: 'evening',   label: 'Avond',   hours: '18–22', flex: 4, color: '#818cf8' },
  { key: 'night',     label: 'Nacht',   hours: '22–06', flex: 8, color: '#475569' },
]

function ratingColor(r) {
  if (r <= 3) return '#ef4444'
  if (r <= 5) return '#f97316'
  if (r <= 7) return '#eab308'
  return '#22c55e'
}

export default function TrackPanel() {
  const { currentTrack: track, meta, metaLoading, handleMetaChange: onMetaChange, genres, hearts, removeHeart: onRemoveHeart, seek: onSeek, duration, progress } = usePlayerContext()
  const [displayName, setDisplayName] = useState('')
  const nameTimer = useRef(null)

  // Sync display_name wanneer track/meta wisselt
  useEffect(() => {
    setDisplayName(meta.display_name || '')
  }, [track?.file, meta.display_name])

  if (!track) return null

  if (metaLoading) return (
    <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SkeletonLine width="60%" height={14} />
      <SkeletonBlock lines={2} gap={6} />
      <SkeletonLine width="40%" height={28} radius={6} />
      <SkeletonBlock lines={3} gap={6} />
    </div>
  )

  const activeGenres = meta.genres ?? []
  const activeMoments = meta.moments ?? []
  const rating = meta.rating ?? 0

  function handleNameChange(e) {
    const val = e.target.value
    setDisplayName(val)
    clearTimeout(nameTimer.current)
    nameTimer.current = setTimeout(() => {
      onMetaChange({ display_name: val || null })
    }, 400)
  }

  function toggleGenre(name) {
    const next = activeGenres.includes(name)
      ? activeGenres.filter(g => g !== name)
      : [...activeGenres, name]
    onMetaChange({ genres: next })
  }

  function toggleMoment(key) {
    const next = activeMoments.includes(key)
      ? activeMoments.filter(m => m !== key)
      : [...activeMoments, key]
    onMetaChange({ moments: next })
  }

  function setRating(r) {
    onMetaChange({ rating: r === rating ? null : r })
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '16px 24px 24px',
      background: 'var(--bg)', borderTop: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>

      {/* Naam */}
      <div>
        <label style={labelStyle}>Naam</label>
        <input
          value={displayName}
          onChange={handleNameChange}
          placeholder={track.name}
          style={{
            width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '7px 10px', borderRadius: 7,
            fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {displayName && displayName !== track.name && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Bestandsnaam: {track.name}</div>
        )}
      </div>

      {/* Genre */}
      <div>
        <label style={labelStyle}>Genre</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {genres.map(g => {
            const active = activeGenres.includes(g.name)
            return (
              <span
                key={g.id}
                onClick={() => toggleGenre(g.name)}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  background: active ? 'var(--accent)' : 'var(--bg2)',
                  color: active ? '#fff' : 'var(--muted)',
                  border: active ? 'none' : '1px solid var(--border)',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {g.name}
              </span>
            )
          })}
          {genres.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Voeg genres toe via Instellingen ⚙</span>
          )}
        </div>
      </div>

      {/* Rating */}
      <div>
        <label style={labelStyle}>
          Beoordeling {rating > 0 && <span style={{ color: ratingColor(rating), fontWeight: 700, letterSpacing: 0 }}>{rating}/10</span>}
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const active = n <= rating
            return (
              <div
                key={n}
                onClick={() => setRating(n)}
                title={`${n}`}
                style={{
                  flex: 1, height: 28, borderRadius: 5, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  background: active ? ratingColor(rating) : 'var(--bg2)',
                  color: active ? '#fff' : 'var(--muted)',
                  border: active ? 'none' : '1px solid var(--border)',
                  transition: 'all 0.1s',
                }}
              >
                {n}
              </div>
            )
          })}
        </div>
      </div>

      {/* Moment / Timeline */}
      <div>
        <label style={labelStyle}>Wanneer klinkt het goed?</label>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 48, border: '1px solid var(--border)' }}>
          {MOMENTS.map(m => {
            const active = activeMoments.includes(m.key)
            return (
              <div
                key={m.key}
                onClick={() => toggleMoment(m.key)}
                style={{
                  flex: m.flex, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  background: active ? m.color : 'var(--bg2)',
                  borderRight: '1px solid var(--border)',
                  transition: 'background 0.2s', userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: active ? '#fff' : 'var(--muted)' }}>{m.label}</span>
                <span style={{ fontSize: 9, color: active ? 'rgba(255,255,255,0.7)' : 'var(--muted)', opacity: 0.8 }}>{m.hours}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', marginTop: 4, height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--bg2)' }}>
          {MOMENTS.map(m => (
            <div key={m.key} style={{ flex: m.flex, background: activeMoments.includes(m.key) ? m.color : 'transparent', transition: 'background 0.2s' }} />
          ))}
        </div>
      </div>

      {/* Favoriete momenten tijdlijn */}
      <HeartsTimeline hearts={hearts} duration={duration} progress={progress} onRemove={onRemoveHeart} onSeek={onSeek} />

    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: 8,
}

function HeartsTimeline({ hearts, duration, progress, onRemove, onSeek }) {
  const [hovered, setHovered] = useState(null)
  const [showHint, setShowHint] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (hearts.length === 0) {
      setShowHint(true)
      timerRef.current = setTimeout(() => setShowHint(false), 2000)
    } else {
      setShowHint(false)
    }
    return () => clearTimeout(timerRef.current)
  }, [hearts.length > 0])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!duration) return null

  const pct = duration ? (progress / duration) * 100 : 0

  function handleBarClick(e) {
    const bar = e.currentTarget
    const ratio = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth
    onSeek(Math.max(0, Math.min(1, ratio)))
  }

  return (
    <div>
      <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          Favoriete momenten
          {hearts.length > 0 && (
            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 5 }}>— {hearts.length}×</span>
          )}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: 'var(--muted)' }}>
          {formatTime(progress)} / {formatTime(duration)}
        </span>
      </div>

      <div
        style={{ position: 'relative', height: 40, userSelect: 'none', cursor: 'pointer' }}
        onClick={handleBarClick}
      >
        {/* Track */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 6, background: 'var(--border)', borderRadius: 3,
          transform: 'translateY(-50%)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
        }} />

        {/* Progress fill */}
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          height: 6, background: 'var(--accent)', borderRadius: 3,
          width: `${pct}%`, transform: 'translateY(-50%)',
          pointerEvents: 'none',
          boxShadow: '0 0 6px color-mix(in srgb, var(--accent) 50%, transparent)',
        }} />

        {/* Progress thumb */}
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', zIndex: 2,
        }} />

        {/* Heart markers */}
        {hearts.map(h => {
          const hp = (h.position / duration) * 100
          const isHovered = hovered === h.id
          return (
            <div
              key={h.id}
              onMouseEnter={() => setHovered(h.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={e => { e.stopPropagation(); onSeek(h.position / duration) }}
              style={{
                position: 'absolute', left: `${hp}%`, top: '50%',
                transform: `translate(-50%, -50%) scale(${isHovered ? 1.3 : 1})`,
                transition: 'transform 0.15s', cursor: 'pointer', zIndex: 3,
              }}
            >
              {isHovered && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%',
                  transform: 'translateX(-50%)', marginBottom: 4,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px', fontSize: 10,
                  color: 'var(--text)', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {formatTime(h.position)}
                  <span
                    onClick={e => { e.stopPropagation(); onRemove(h.id) }}
                    style={{ color: 'var(--muted)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                    title="Verwijderen"
                  >×</span>
                </div>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" strokeWidth="1">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
          )
        })}

        {/* Hint (auto-hides after 2s) */}
        {hearts.length === 0 && showHint && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', opacity: 0.6,
            pointerEvents: 'none',
          }}>
            Druk ♥ tijdens het afspelen om momenten te markeren
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
