import { useState } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import { AcSeg } from '@components/arcade/controls.jsx'
import { useTrackList } from './hooks/useTrackList.js'
import { MOMENT_COLOR, ratingColor, genreColor } from './format.js'

// Tracklist als highscore-lijst (item 1339): sorteren, filteren, mappen inklappen.
const SORTS = [
  { value: 'newest', label: 'NEW' }, { value: 'name', label: 'NAME' }, { value: 'rating', label: '★' },
  { value: 'hearts', label: '♥' }, { value: 'plays', label: '▶' },
]

function TrackRow({ t, rank, active, meta, show, excluded, onPlay }) {
  const color = ratingColor(meta?.rating)
  return (
    <button type="button" className={`mma-trk${active ? ' on' : ''}`} style={excluded ? { opacity: 0.45 } : undefined} onClick={onPlay}>
      <span className="rk">{active ? '▶' : String(rank).padStart(2, '0')}</span>
      <span className="mma-trk-main">
        <b title={meta?.display_name || t.name}>{meta?.display_name || t.name}</b>
        <span className="meta">
          {excluded && <span style={{ color: 'var(--ac-pink)' }}>⊘</span>}
          {show.playCount && meta?.play_count > 0 && <span>▶{meta.play_count}</span>}
          {show.hearts && meta?.heart_count > 0 && <span style={{ color: 'var(--ac-pink)' }}>♥{meta.heart_count}</span>}
          {show.moments && meta?.moments?.length > 0 && (
            <span className="dots">{meta.moments.map(m => <i key={m} style={{ background: MOMENT_COLOR[m] }} />)}</span>
          )}
          {show.ext && <span>{t.ext?.toUpperCase()}</span>}
        </span>
      </span>
      {show.rating && color ? <span className="rate" style={{ color }}>{meta.rating}</span> : <span />}
    </button>
  )
}

export default function TrackList({ onOpenSettings, onOpenDisplay, header = true }) {
  const { tracks, tracksLoading, currentIdx, loadTrack, metas, genres, isAdmin } = usePlayerContext()
  const tl = useTrackList(tracks, metas, genres)
  const [collapsed, setCollapsed] = useState(new Set())

  const toggleFolder = f => setCollapsed(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n })
  const row = (t, i) => {
    const idx = tracks.indexOf(t)
    const m = metas[t.file]
    return <TrackRow key={t.file} t={t} rank={i + 1} active={idx === currentIdx} meta={m} show={tl.show}
      excluded={isAdmin && m?.excluded} onPlay={() => loadTrack(idx, true)} />
  }

  return (
    <aside className="mma-side">
      {header && (
        <div className="mma-side-head">
          <span className="ac-logo">♫ MIX</span>
          <button type="button" className="ac-icon" onClick={onOpenSettings} aria-label="Settings">⚙</button>
        </div>
      )}
      <div className="mma-tools">
        <div className="mma-tools-row">
          <AcSeg full value={tl.sortBy} onChange={tl.setSortBy} items={SORTS} ariaLabel="Sort" />
          {onOpenDisplay && <button type="button" className="ac-icon" onClick={onOpenDisplay} aria-label="Tracklist display" title="Tracklist display">⊞</button>}
        </div>
        <input className="ac-input" placeholder="Search tracks…" value={tl.search} onChange={e => tl.setSearch(e.target.value)} aria-label="Search tracks" />
        {tl.usedGenres.length > 0 && (
          <div className="mma-chips">
            {tl.usedGenres.map(g => (
              <button key={g} type="button" className={`mma-chip${tl.filterGenre === g ? ' on' : ''}`} style={{ '--c': genreColor(genres, g) }}
                onClick={() => tl.setFilterGenre(tl.filterGenre === g ? null : g)}>{g.toUpperCase()}</button>
            ))}
          </div>
        )}
        <div className="mma-tools-row">
          <AcSeg value={tl.minRating} onChange={tl.setMinRating} ariaLabel="Minimum rating"
            items={[0, 5, 7, 9].map(r => ({ value: r, label: r ? `≥${r}★` : 'ALL' }))} />
          <button type="button" className={`ac-icon${tl.hasHearts ? ' on' : ''}`} style={tl.hasHearts ? { color: 'var(--ac-pink)', borderColor: 'var(--ac-pink)' } : undefined}
            onClick={() => tl.setHasHearts(!tl.hasHearts)} aria-pressed={tl.hasHearts} aria-label="Only tracks with hearts">♥</button>
        </div>
      </div>
      <div className="mma-count">{tl.list.length !== tracks.length ? `${tl.list.length} / ${tracks.length}` : tracks.length} TRACKS</div>
      <div className="mma-list">
        {tracksLoading && <div className="ac-state"><span className="ac-label ac-blink">LOADING…</span></div>}
        {!tracksLoading && tl.folders.map(f => {
          const items = tl.list.filter(t => t.folder === f)
          return (
            <div key={f}>
              <button type="button" className="mma-folder" onClick={() => toggleFolder(f)}>
                <span>{collapsed.has(f) ? '▸' : '▾'}</span><span className="name">{f.toUpperCase()}</span><span>{items.length}</span>
              </button>
              {!collapsed.has(f) && items.map(row)}
            </div>
          )
        })}
        {!tracksLoading && tl.list.filter(t => !t.folder).map(row)}
      </div>
    </aside>
  )
}
