import { useState, useEffect } from 'react'
import { getPlayer, getPlayerPhotos } from '../api.js'

export default function PublicPlayer({ playerId, onBack }) {
  const [player, setPlayer] = useState(null)
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    getPlayer(playerId).then(setPlayer).catch(e => setError(e.message))
    getPlayerPhotos(playerId).then(setPhotos).catch(() => {})
  }, [playerId])

  if (error) return <p style={{ color: '#c23b3b' }}>{error}</p>
  if (!player) return <p>Laden...</p>

  return (
    <div>
      <a className="yof-back" href="#" onClick={e => { e.preventDefault(); onBack() }}>&larr; terug naar het team</a>
      <div className="yof-card" style={{ textAlign: 'center' }}>
        <div className="avatar" style={{
          width: 72, height: 72, margin: '0 auto 12px', borderRadius: '50%',
          background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
        }}>
          {player.shirt_number ?? '?'}
        </div>
        <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>{player.nickname || player.name}</h2>
        {player.nickname && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{player.name}</p>}
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          {player.position || '-'} {player.shirt_number ? `· #${player.shirt_number}` : ''}
        </p>
        {player.bio && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{player.bio}</p>}
      </div>

      {photos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Foto&rsquo;s van {player.nickname || player.name}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
            {photos.map(p => (
              <a key={p.id} href={`/api/yearof-mo14/photos/${p.id}/full.jpg`} target="_blank" rel="noreferrer">
                <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
