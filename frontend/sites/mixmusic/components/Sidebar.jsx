import { useState } from 'react'
import { usePlayerContext } from '../context/PlayerContext.jsx'
import { SkeletonLine } from '@components/Skeleton.jsx'
import { useUiPref } from '@core/useUiPref.js'

function ratingColor(r) {
  if (!r) return null
  if (r <= 3) return '#ef4444'
  if (r <= 5) return '#f97316'
  if (r <= 7) return '#eab308'
  return '#22c55e'
}

const MOMENT_COLORS = {
  morning: '#f59e0b',
  afternoon: '#10b981',
  evening: '#818cf8',
  night: '#475569',
}

const s = {
  sidebar: {
    width: 'var(--sidebar-w)', background: 'var(--bg2)',
    borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    transition: 'background var(--transition)',
  },
  header: {
    display: 'flex', alignItems: 'center', padding: '18px 20px 14px',
    borderBottom: '1px solid var(--border)', gap: '10px',
  },
  logo: {
    fontFamily: 'var(--font-display)', fontSize: '20px',
    fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--accent)',
  },
  searchWrap: { padding: '12px 14px' },
  searchInput: {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '8px 12px', borderRadius: '8px',
    fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none',
  },
  count: { padding: '0 14px 8px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' },
  list: { flex: 1, overflowY: 'auto', paddingBottom: '8px' },
  folderHeader: {
    padding: '8px 14px', fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
    userSelect: 'none',
  },
  trackItem: (active) => ({
    padding: '7px 14px 7px 28px', fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '8px',
    background: active ? 'var(--bg3)' : 'transparent',
    transition: 'background 0.15s',
  }),
  trackName: (active) => ({
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    color: active ? 'var(--accent)' : 'var(--text)',
  }),
  badge: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 5px',
    borderRadius: '4px', background: 'var(--bg3)', color: 'var(--muted)',
    border: '1px solid var(--border)', whiteSpace: 'nowrap', flexShrink: 0,
  },
  reloadBtn: {
    margin: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)',
    color: 'var(--muted)', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer',
    fontFamily: 'var(--font-body)', fontSize: '12px', width: 'calc(100% - 28px)',
  },
}

function MomentDots({ moments }) {
  if (!moments?.length) return null
  return (
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {moments.map(m => (
        <div key={m} style={{ width: 5, height: 5, borderRadius: '50%', background: MOMENT_COLORS[m] ?? 'var(--muted)' }} />
      ))}
    </div>
  )
}

export default function Sidebar({ onOpenSettings }) {
  const { tracks, tracksLoading, currentIdx, loadTrack, reload: onReload, metas, genres } = usePlayerContext()
  const onSelect = (idx) => loadTrack(idx, true)
  const [search, setSearch]               = useState('')
  const [collapsed, setCollapsed]         = useState(new Set())
  const [sortBy, setSortBy]               = useUiPref('mm_sort', 'newest')
  const [filterGenre, setFilterGenre]     = useUiPref('mm_filter_genre', null, v => v === 'null' ? null : v)
  const [filterMinRating, setFilterMinRating] = useUiPref('mm_filter_rating', 0, Number)
  const [filterHasHearts, setFilterHasHearts] = useUiPref('mm_filter_hearts', false, v => v === 'true')

  const q = search.toLowerCase()
  const searched = q
    ? tracks.filter(t => t.name.toLowerCase().includes(q) || t.folder.toLowerCase().includes(q))
    : tracks

  // Filters toepassen
  let filtered = searched
  if (filterGenre)      filtered = filtered.filter(t => metas[t.file]?.genres?.includes(filterGenre))
  if (filterMinRating)  filtered = filtered.filter(t => (metas[t.file]?.rating ?? 0) >= filterMinRating)
  if (filterHasHearts)  filtered = filtered.filter(t => (metas[t.file]?.heart_count ?? 0) > 0)

  // Sortering toepassen
  if (sortBy === 'name') {
    filtered = [...filtered].sort((a, b) =>
      (metas[a.file]?.display_name || a.name).toLowerCase()
        .localeCompare((metas[b.file]?.display_name || b.name).toLowerCase()))
  } else if (sortBy === 'rating') {
    filtered = [...filtered].sort((a, b) => (metas[b.file]?.rating ?? 0) - (metas[a.file]?.rating ?? 0))
  } else if (sortBy === 'hearts') {
    filtered = [...filtered].sort((a, b) => (metas[b.file]?.heart_count ?? 0) - (metas[a.file]?.heart_count ?? 0))
  } else if (sortBy === 'plays') {
    filtered = [...filtered].sort((a, b) => (metas[b.file]?.play_count ?? 0) - (metas[a.file]?.play_count ?? 0))
  }

  // Genres die daadwerkelijk in gebruik zijn
  const usedGenreNames = [...new Set(Object.values(metas).flatMap(m => m.genres || []))]
    .filter(g => genres.some(x => x.name === g))

  const folders = [...new Set(filtered.map(t => t.folder).filter(Boolean))].sort()

  function toggleFolder(f) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  function renderTrack(t, i) {
    const idx = tracks.indexOf(t)
    const active = idx === currentIdx
    const m = metas[t.file]
    const color = m?.rating ? ratingColor(m.rating) : null
    const label = m?.display_name || t.name
    return (
      <div
        key={t.file}
        style={s.trackItem(active)}
        onClick={() => onSelect(idx)}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', minWidth: '18px' }}>
          {active ? '▶' : i + 1}
        </span>
        <span style={s.trackName(active)} title={label}>{label}</span>
        {m?.moments?.length > 0 && <MomentDots moments={m.moments} />}
        {m?.heart_count > 0 && (
          <span style={{ fontSize: '10px', color: '#e11d48', flexShrink: 0 }} title={`${m.heart_count} favoriete moment${m.heart_count !== 1 ? 'en' : ''}`}>
            {'♥'.repeat(Math.min(m.heart_count, 3))}{m.heart_count > 3 ? `+${m.heart_count - 3}` : ''}
          </span>
        )}
        {m?.play_count > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)', flexShrink: 0 }} title={`${m.play_count}× afgespeeld`}>
            ▶{m.play_count}
          </span>
        )}
        {color && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 5px', borderRadius: '4px', background: color + '22', color, border: `1px solid ${color}55`, flexShrink: 0 }}>
            {m.rating}
          </span>
        )}
        <span style={s.badge}>{t.ext}</span>
      </div>
    )
  }

  return (
    <div style={s.sidebar}>
      <div style={s.header}>
        <span style={s.logo}>♫ Mix</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onOpenSettings}
            title="Instellingen"
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', borderRadius: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={s.searchWrap}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Zoeken in tracks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Sort + Filter balk */}
      <div style={{ padding: '0 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Sortering */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[['newest', 'Nieuw'], ['name', 'Naam'], ['rating', '★'], ['hearts', '♥'], ['plays', '▶']].map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)} style={{
              flex: 1, padding: '4px 0', fontSize: '11px', border: 'none', borderRadius: 5, cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              background: sortBy === val ? 'var(--accent)' : 'var(--bg3)',
              color: sortBy === val ? '#fff' : 'var(--muted)',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Genre chips */}
        {usedGenreNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {usedGenreNames.map(g => {
              const obj = genres.find(x => x.name === g)
              const active = filterGenre === g
              return (
                <button key={g} onClick={() => setFilterGenre(active ? null : g)} style={{
                  padding: '2px 7px', fontSize: '10px', borderRadius: 9, cursor: 'pointer',
                  background: active ? (obj?.color || 'var(--accent)') : 'var(--bg3)',
                  color: active ? '#fff' : 'var(--muted)',
                  border: `1px solid ${active ? (obj?.color || 'var(--accent)') : 'var(--border)'}`,
                }}>
                  {g}
                </button>
              )
            })}
          </div>
        )}

        {/* Rating + Hartjes filter */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {[0, 5, 7, 9].map(r => (
            <button key={r} onClick={() => setFilterMinRating(r)} style={{
              padding: '3px 6px', fontSize: '10px', borderRadius: 5, cursor: 'pointer',
              background: filterMinRating === r ? 'var(--accent)' : 'var(--bg3)',
              color: filterMinRating === r ? '#fff' : 'var(--muted)',
              border: '1px solid var(--border)',
            }}>
              {r === 0 ? 'Alle' : `≥${r}★`}
            </button>
          ))}
          <button onClick={() => setFilterHasHearts(!filterHasHearts)} style={{
            padding: '3px 8px', fontSize: '11px', borderRadius: 5, cursor: 'pointer', marginLeft: 'auto',
            background: filterHasHearts ? '#e11d48' : 'var(--bg3)',
            color: filterHasHearts ? '#fff' : 'var(--muted)',
            border: '1px solid var(--border)',
          }}>
            ♥
          </button>
        </div>
      </div>

      <div style={s.count}>{filtered.length !== tracks.length ? `${filtered.length} / ${tracks.length} tracks` : `${tracks.length} tracks`}</div>

      <div style={s.list}>
        {tracksLoading && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonLine key={i} width={`${55 + (i * 17) % 35}%`} height={11} />
            ))}
          </div>
        )}
        {!tracksLoading && (
          <>
            {folders.map(folder => {
              const folderTracks = filtered.filter(t => t.folder === folder)
              const isCollapsed = collapsed.has(folder)
              return (
                <div key={folder}>
                  {folder && (
                    <div style={s.folderHeader} onClick={() => toggleFolder(folder)}>
                      <span style={{ transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'none', fontSize: '10px' }}>▾</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder}</span>
                      <span style={{ fontSize: '11px', opacity: 0.5 }}>{folderTracks.length}</span>
                    </div>
                  )}
                  {!isCollapsed && folderTracks.map((t, i) => renderTrack(t, i))}
                </div>
              )
            })}
            {filtered.filter(t => !t.folder).map((t, i) => renderTrack(t, i))}
          </>
        )}
      </div>

    </div>
  )
}
