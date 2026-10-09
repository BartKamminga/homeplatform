import { useState } from 'react'
import { PhotoLightbox, PhotoThumb } from '../../screens/PhotoLightbox.jsx'

// Het tonen-component voor foto's (item 1258): overal waar foto's in een blok
// of bericht staan - op de site en in het bewerkscherm - dezelfde grid met
// eigen lightbox (alleen door de foto's van dit grid swipen, item 1243).
// Bewerken gaat altijd via de PhotoManager.
export default function PhotoGrid({ photos, min = 90, showConcept = false }) {
  const [index, setIndex] = useState(null)
  if (photos.length === 0) return null
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 6, marginTop: min < 90 ? 8 : 0 }}>
        {photos.map((p, i) => (
          <a key={p.id} href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); setIndex(i) }}
            style={{ position: 'relative', display: 'block' }}>
            <PhotoThumb photo={p} />
            {showConcept && p.status === 'concept' && (
              <span style={{
                position: 'absolute', top: 3, left: 3, background: '#fde68a', color: '#92400e',
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
              }}>concept</span>
            )}
          </a>
        ))}
      </div>
      <PhotoLightbox photos={photos} index={index} onClose={() => setIndex(null)} onNavigate={setIndex} />
    </>
  )
}
