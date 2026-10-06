import { useState, useEffect } from 'react'
import { getPlayerPhotosForFavorites, setPlayerFavorite } from '../api.js'
import { PhotoLightbox, PhotoThumb } from './PhotoLightbox.jsx'

// Favoriete foto's per speelster (item 1199): max 6, alleen foto's, alleen
// de beheerder kiest. Blok "Favorieten" op de spelerspagina en - als enige
// foto's - op de spelerslink voor vrienden.

export const MAX_FAVORITES = 6

// Publiek blok: grid + lightbox. showLikes=false op de spelerslink.
export function FavoritesBlock({ photos, title = 'Favorieten', showLikes = true }) {
  const [index, setIndex] = useState(null)
  if (!photos || photos.length === 0) return null
  return (
    <div className="yof-card" style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>⭐ {title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {photos.map((p, i) => (
          <a key={p.id} href="#" onClick={e => { e.preventDefault(); setIndex(i) }}>
            <PhotoThumb photo={p} />
          </a>
        ))}
      </div>
      <PhotoLightbox photos={photos} index={index} onClose={() => setIndex(null)} onNavigate={setIndex} showLikes={showLikes} />
    </div>
  )
}

// Ster-knop over een foto-tegel (beheer).
export function FavoriteStar({ active, disabled, onClick }) {
  return (
    <button onClick={e => { e.preventDefault(); e.stopPropagation(); onClick() }} disabled={disabled}
      title={active ? 'Favoriet - klik om te verwijderen' : (disabled ? `Maximaal ${MAX_FAVORITES} favorieten` : 'Maak favoriet')}
      style={{
        position: 'absolute', top: 4, right: 4, width: 30, height: 30, borderRadius: '50%',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 16, lineHeight: '30px', padding: 0,
        background: active ? '#f4c81e' : 'rgba(255,255,255,.85)', opacity: disabled ? 0.5 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,.3)',
      }}>
      {active ? '★' : '☆'}
    </button>
  )
}

// Beheer: alle foto's waarop de speelster getagd is, met ster (uitklapper in
// de spelerslijst).
export function PlayerPhotosPanel({ playerId }) {
  const [photos, setPhotos] = useState(null)
  const [error, setError] = useState('')

  function load() {
    getPlayerPhotosForFavorites(playerId).then(setPhotos).catch(e => setError(e.message))
  }
  useEffect(load, [playerId])

  async function toggle(photo) {
    try {
      setError('')
      await setPlayerFavorite(playerId, photo.id, !photo.favorite)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (!photos) return <p style={{ fontSize: 13 }}>{error || 'Laden...'}</p>
  const count = photos.filter(p => p.favorite).length

  return (
    <div className="yof-card" style={{ padding: 12, border: '1px solid #e6e9f0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h4 style={{ fontSize: 14, margin: 0 }}>Foto's</h4>
        <span style={{ fontSize: 12, color: '#888', flex: 1 }}>
          ⭐ = favoriet, getoond op de spelerslink en de spelerspagina
        </span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{count}/{MAX_FAVORITES}</span>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
      {photos.length === 0 ? (
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Nog geen foto's waarop zij getagd is.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
          {photos.map(p => (
            <div key={p.id} style={{ position: 'relative', opacity: p.status === 'published' ? 1 : 0.6 }}>
              <PhotoThumb photo={p} />
              <FavoriteStar active={p.favorite} disabled={!p.favorite && count >= MAX_FAVORITES} onClick={() => toggle(p)} />
              {p.status !== 'published' && (
                <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, background: '#fff', borderRadius: 4, padding: '1px 4px' }}>
                  concept
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
