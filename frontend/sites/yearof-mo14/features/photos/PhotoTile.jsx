import { PhotoThumb } from '../../screens/PhotoLightbox.jsx'

// Lichte tegel in de PhotoManager: thumbnail + selectievakje + status +
// tags/highlight/favoriet-indicatoren. Alle bewerkingen gaan via het
// detailvenster of de bulkbalk (item 1168: 350+ fotos per wedstrijd).

const pill = {
  position: 'absolute', zIndex: 1, fontSize: 10, fontWeight: 700, padding: '2px 6px',
  borderRadius: 999, background: 'rgba(0,0,0,.6)', color: 'white',
}

export default function PhotoTile({ photo, selected, onToggleSelect, onOpen }) {
  const tagCount = photo.player_ids?.length || 0
  const live = photo.status === 'published'
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); onToggleSelect(photo.id, e.shiftKey) }}
        aria-label="Selecteer" title="Selecteren (shift-klik = reeks)"
        style={{
          position: 'absolute', top: 4, left: 4, zIndex: 2, width: 22, height: 22, padding: 0,
          borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: selected ? 'none' : '2px solid rgba(255,255,255,.85)',
          background: selected ? '#16a34a' : 'rgba(0,0,0,.35)', color: 'white', fontSize: 13, fontWeight: 700,
        }}>
        {selected ? '✓' : ''}
      </button>
      <span style={{
        ...pill, top: 4, right: 4, fontSize: 9,
        color: photo.archived_at ? 'white' : live ? '#065f46' : '#92400e',
        background: photo.archived_at ? '#6b7280' : live ? '#bbf7d0' : '#fde68a',
      }}>
        {photo.archived_at ? 'archief' : live ? 'live' : 'concept'}
      </span>
      <span style={{ ...pill, bottom: 4, left: 4, background: tagCount ? 'rgba(0,0,0,.6)' : 'rgba(194,59,59,.85)' }}
        title={tagCount ? `${tagCount} speelster(s) getagd` : 'Nog niemand getagd'}>
        &#127991; {tagCount}
      </span>
      {(photo.match_highlight || (photo.favorite_player_ids || []).length > 0) && (
        <span style={{ ...pill, bottom: 4, right: 4, color: '#fbbf24' }}
          title={[photo.match_highlight && 'Wedstrijd-highlight', (photo.favorite_player_ids || []).length && 'Favoriet van een speelster'].filter(Boolean).join(' · ')}>
          {photo.match_highlight ? '⭐' : ''}{(photo.favorite_player_ids || []).length ? '♥' : ''}
        </span>
      )}
      <a href="#" onClick={e => { e.preventDefault(); onOpen(photo) }} style={{ display: 'block', outline: selected ? '3px solid #16a34a' : 'none', borderRadius: 8 }}>
        <PhotoThumb photo={photo} />
      </a>
    </div>
  )
}
