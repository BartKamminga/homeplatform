import { useState } from 'react'
import ThemeSwitcher from '@components/ThemeSwitcher.jsx'

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
    padding: '8px 14px 8px 28px', fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '10px',
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
  themeWrap: {
    padding: '10px 14px',
    borderTop: '1px solid var(--border)',
  },
}

export default function Sidebar({ tracks, currentIdx, onSelect, onReload }) {
  const [search, setSearch]       = useState('')
  const [collapsed, setCollapsed] = useState(new Set())

  const q = search.toLowerCase()
  const filtered = q
    ? tracks.filter(t => t.name.toLowerCase().includes(q) || t.folder.toLowerCase().includes(q))
    : tracks

  const folders = [...new Set(filtered.map(t => t.folder))].sort()

  function toggleFolder(f) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  return (
    <div style={s.sidebar}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.logo}>♫ Mix</span>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Zoeken in tracks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={s.count}>{tracks.length} tracks</div>

      {/* Track list */}
      <div style={s.list}>
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
              {!isCollapsed && folderTracks.map((t, i) => {
                const idx = tracks.indexOf(t)
                const active = idx === currentIdx
                return (
                  <div
                    key={t.file}
                    style={s.trackItem(active)}
                    onClick={() => onSelect(idx)}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', minWidth: '20px' }}>
                      {active ? '▶' : i + 1}
                    </span>
                    <span style={s.trackName(active)} title={t.name}>{t.name}</span>
                    <span style={s.badge}>{t.ext}</span>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Tracks zonder map */}
        {filtered.filter(t => !t.folder).map((t, i) => {
          const idx = tracks.indexOf(t)
          const active = idx === currentIdx
          return (
            <div
              key={t.file}
              style={s.trackItem(active)}
              onClick={() => onSelect(idx)}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', minWidth: '20px' }}>
                {active ? '▶' : i + 1}
              </span>
              <span style={s.trackName(active)} title={t.name}>{t.name}</span>
              <span style={s.badge}>{t.ext}</span>
            </div>
          )
        })}
      </div>

      <button style={s.reloadBtn} onClick={onReload}>↺ Vernieuwen</button>

      {/* Thema switch */}
      <div style={s.themeWrap}>
        <ThemeSwitcher compact />
      </div>
    </div>
  )
}
