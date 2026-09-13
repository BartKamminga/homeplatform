import { useState, useEffect } from 'react'
import { getPlayer, getPlayerPhotos, getTimeline } from '../api.js'
import { PhotoLightbox, PhotoThumb } from './PhotoLightbox.jsx'

export default function PublicPlayer({ playerId, onBack }) {
  const [player, setPlayer] = useState(null)
  const [photos, setPhotos] = useState([])
  const [entries, setEntries] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPlayer(playerId).then(setPlayer).catch(e => setError(e.message))
    getPlayerPhotos(playerId).then(setPhotos).catch(() => {})
    getTimeline().then(setEntries).catch(() => {})
  }, [playerId])

  function entryFor(matchRef) {
    return entries.find(e => e.match_ref === matchRef)
  }

  const photoGroups = (() => {
    const byMatch = {}
    photos.forEach(p => {
      if (!byMatch[p.match_ref]) byMatch[p.match_ref] = []
      byMatch[p.match_ref].push(p)
    })
    return Object.entries(byMatch)
      .map(([matchRef, items]) => ({ matchRef, items, entry: entryFor(matchRef) }))
      .sort((a, b) => {
        const dateA = a.entry?.date || ''
        const dateB = b.entry?.date || ''
        return dateB.localeCompare(dateA)
      })
  })()

  const flatPhotos = photoGroups.flatMap(g => g.items)

  if (error) return <p style={{ color: '#c23b3b' }}>{error}</p>
  if (!player) return <p>Laden...</p>

  return (
    <div>
      <a className="yof-back" href="#" onClick={e => { e.preventDefault(); onBack() }}>&larr; terug naar het team</a>
      <div className="yof-card" style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 72, margin: '0 auto 12px' }}>
          {player.photo_url ? (
            <img src={player.photo_url} alt="" style={{
              width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', display: 'block',
            }} />
          ) : (
            <div className="avatar" style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
            }}>
              {player.shirt_number ?? '?'}
            </div>
          )}
          {player.photo_url && player.shirt_number != null && (
            <span className="shirt-badge" style={{ fontSize: 13, minWidth: 24, height: 24 }}>{player.shirt_number}</span>
          )}
        </div>
        <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>{player.nickname || player.name}</h2>
        {player.nickname && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{player.name}</p>}
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          {player.position || '-'} {player.shirt_number ? `· #${player.shirt_number}` : ''}
        </p>
        {player.bio && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{player.bio}</p>}
        {player.fun_facts && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic' }}>&ldquo;{player.fun_facts}&rdquo;</p>
        )}
      </div>

      {photos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Foto&rsquo;s van {player.nickname || player.name}</h3>
          {photoGroups.map(g => (
            <div key={g.matchRef} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{g.entry?.title || g.matchRef}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
                {g.items.map(p => (
                  <a key={p.id} href="#" onClick={e => { e.preventDefault(); setLightboxIndex(flatPhotos.indexOf(p)) }}>
                    <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <PhotoLightbox photos={flatPhotos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />
    </div>
  )
}
