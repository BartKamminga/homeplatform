import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { AcPanel } from '@components/arcade/overlays.jsx'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import { MOMENTS, MOMENT_COLOR, genreColor, fmtDuration } from './format.js'

// Statistieken (item 1339): stat-grid zoals het VBT LIVE-paneel, toplijsten en gloeiende balken.
function TopList({ items, valueKey, fmt }) {
  if (!items?.length) return <p className="ac-hint">No data yet.</p>
  return (
    <div className="mma-top">
      {items.map((it, i) => (
        <div key={it.file}><span>{i + 1}</span><span title={it.label}>{it.label}</span><span>{fmt(it[valueKey])}</span></div>
      ))}
    </div>
  )
}

export default function StatsPanel({ onClose }) {
  const { genres } = usePlayerContext()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.get('/api/mixmusic/stats').then(setStats).catch(() => {}).finally(() => setLoading(false)) }, [])

  const genreEntries = stats ? Object.entries(stats.genre_distribution) : []
  const genreMax = Math.max(1, ...genreEntries.map(([, c]) => c))
  const momentTotal = stats ? Object.values(stats.moment_distribution).reduce((a, b) => a + b, 0) : 0

  return (
    <AcPanel drawer title="STATISTICS" tone="cyan" onClose={onClose}>
      {loading && <span className="ac-label ac-blink">LOADING…</span>}
      {!loading && !stats && <p className="ac-hint">Statistics are not available right now.</p>}
      {stats && <>
        <div className="ac-grid">
          <div><small>LISTENED</small><b>{fmtDuration(stats.total_play_seconds)}</b><i>total time</i></div>
          <div><small>PLAYS</small><b style={{ color: 'var(--ac-yellow)' }}>{stats.total_plays}</b><i>times</i></div>
          <div><small>TRACKS</small><b>{stats.tracked_tracks}</b><i>with plays</i></div>
          <div><small>TOP HEARTS</small><b style={{ color: 'var(--ac-pink)' }}>{stats.top_by_hearts?.[0]?.count ?? 0}</b><i>{stats.top_by_hearts?.[0]?.label ?? '–'}</i></div>
        </div>
        <div><span className="ac-label">Most listened (time)</span><TopList items={stats.top_by_time} valueKey="seconds" fmt={fmtDuration} /></div>
        <div><span className="ac-label">Most played</span><TopList items={stats.top_by_plays} valueKey="count" fmt={n => `${n}×`} /></div>
        <div><span className="ac-label">Most hearts</span><TopList items={stats.top_by_hearts} valueKey="count" fmt={n => `♥${n}`} /></div>
        {genreEntries.length > 0 && (
          <div>
            <span className="ac-label">Genres</span>
            <div className="ac-bars">
              {genreEntries.map(([g, c]) => {
                const col = genreColor(genres, g)
                return <div key={g}><span className="lbl" style={{ color: col }}>{g.toUpperCase()}</span><span className="bar" style={{ '--c': col, width: `${c / genreMax * 100}%` }} /><em>{c}</em></div>
              })}
            </div>
          </div>
        )}
        {momentTotal > 0 && (
          <div>
            <span className="ac-label">Moments</span>
            <div className="mma-moments small">
              {MOMENTS.filter(m => stats.moment_distribution[m.key]).map(m => (
                <div key={m.key} className="on" style={{ flex: stats.moment_distribution[m.key], '--c': MOMENT_COLOR[m.key] }}>
                  <b>{m.label}</b><small>{Math.round(stats.moment_distribution[m.key] / momentTotal * 100)}%</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </AcPanel>
  )
}
