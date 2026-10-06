import PhotoTile from './PhotoTile.jsx'

// 1 groep in de PhotoManager: kopregel (naam, aantallen, inklappen, groep
// selecteren) + grid. Zonder label (indeling "geen") alleen het grid.
export default function PhotoGroup({ group, size, collapsed, onToggleCollapse, selected, onToggleSelect, onSelectGroup, onOpen }) {
  const concept = group.photos.filter(p => p.status !== 'published').length
  const untagged = group.photos.filter(p => p.player_ids.length === 0).length
  const allSelected = group.photos.length > 0 && group.photos.every(p => selected.has(p.id))

  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`, gap: 6 }}>
      {group.photos.map(p => (
        <PhotoTile key={p.id} photo={p} selected={selected.has(p.id)} onToggleSelect={onToggleSelect} onOpen={onOpen} />
      ))}
    </div>
  )
  if (!group.label) return grid

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 10px', marginBottom: 6,
        background: '#f4f6fb', borderLeft: '4px solid #f4c81e', borderRadius: 6, fontSize: 13,
      }}>
        <button onClick={onToggleCollapse} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: 0 }}>
          {collapsed ? '▸' : '▾'} {group.label}
        </button>
        <span style={{ color: '#666', fontSize: 12, flex: 1 }}>
          {group.photos.length} foto&rsquo;s
          {concept > 0 && <> &middot; <span style={{ color: '#92400e' }}>{concept} concept</span></>}
          {untagged > 0 && <> &middot; <span style={{ color: '#c23b3b' }}>{untagged} zonder tags</span></>}
        </span>
        <button onClick={() => onSelectGroup(group.photos, !allSelected)} className="yof-btn-secondary" style={{ fontSize: 11 }}>
          {allSelected ? 'Groep deselecteren' : 'Groep selecteren'}
        </button>
      </div>
      {!collapsed && grid}
    </div>
  )
}
