import { useState } from 'react'
import { fmtTime } from './format.js'

// Voortgangsbalk met favoriete momenten (item 1339): klik = seek, hartje = naar dat moment, × = verwijderen.
export default function HeartsBar({ hearts = [], pending = [], duration, progress, onSeek, onRemove, tall = false }) {
  const [hover, setHover] = useState(null)
  if (!duration) return <div className={`mma-hearts${tall ? ' tall' : ''}`} />
  const pct = Math.min(100, (progress / duration) * 100)

  function seek(e) {
    const r = e.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
  }

  return (
    <div className={`mma-hearts${tall ? ' tall' : ''}`} onClick={seek} role="slider" aria-label="Position"
      aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(progress)}>
      <div className="fill" style={{ width: `${pct}%` }} />
      {hearts.map(h => (
        <span key={h.id} className="h" style={{ left: `${(h.position / duration) * 100}%` }}
          onMouseEnter={() => setHover(h.id)} onMouseLeave={() => setHover(null)}
          onClick={e => { e.stopPropagation(); onSeek(h.position / duration) }}>
          ♥
          {hover === h.id && onRemove && (
            <span className="tip">{fmtTime(h.position)}
              <button type="button" onClick={e => { e.stopPropagation(); onRemove(h.id) }} aria-label="Remove heart">×</button>
            </span>
          )}
        </span>
      ))}
      {pending.map(h => <span key={h.id} className="h pending" style={{ left: `${(h.position / duration) * 100}%` }}>♡</span>)}
    </div>
  )
}
