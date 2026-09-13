import { useState, useEffect } from 'react'
import { getPhotosModeration, updatePhoto, deletePhoto, getTimeline, getPlayers, tagPhoto, untagPhoto } from '../api.js'

export default function PhotosAdmin() {
  const [photos, setPhotos] = useState([])
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')
  const [pickFor, setPickFor] = useState({}) // photoId -> geselecteerde player_id in de dropdown

  function load() {
    getPhotosModeration().then(setPhotos).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    getTimeline().then(setEntries).catch(() => {})
    getPlayers().then(setPlayers).catch(() => {})
  }, [])

  function entryTitle(matchRef) {
    return entries.find(e => e.match_ref === matchRef)?.title || matchRef
  }
  function playerName(id) {
    const p = players.find(p => p.id === id)
    return p ? (p.nickname || p.name) : '?'
  }

  async function togglePublish(photo) {
    try {
      await updatePhoto(photo.id, { status: photo.status === 'published' ? 'concept' : 'published' })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(id) {
    try {
      await deletePhoto(id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function addTag(photo) {
    const playerId = pickFor[photo.id]
    if (!playerId) return
    try {
      await tagPhoto(photo.id, playerId)
      setPickFor({ ...pickFor, [photo.id]: '' })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeTag(photo, playerId) {
    try {
      await untagPhoto(photo.id, playerId)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Foto&rsquo;s modereren</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {photos.map(p => {
          const availablePlayers = players.filter(pl => !p.player_ids.includes(pl.id))
          return (
            <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#eee' }} />
              <div style={{ padding: 8, fontSize: 11 }}>
                <div style={{ color: p.status === 'published' ? '#16a34a' : '#d97706', fontWeight: 700, marginBottom: 4 }}>
                  {p.status === 'published' ? 'Gepubliceerd' : 'Concept'}
                </div>
                <div style={{ color: '#888', marginBottom: 6 }}>
                  {p.photo_type} &middot; <strong>{entryTitle(p.match_ref)}</strong>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {p.player_ids.map(pid => (
                    <span key={pid} style={{ background: '#eef1f8', borderRadius: 999, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {playerName(pid)}
                      <button onClick={() => removeTag(p, pid)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 11, padding: 0 }}>&times;</button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <select value={pickFor[p.id] || ''} onChange={e => setPickFor({ ...pickFor, [p.id]: e.target.value })}
                    style={{ flex: 1, fontSize: 11 }}>
                    <option value="">+ speler taggen</option>
                    {availablePlayers.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.nickname || pl.name}</option>
                    ))}
                  </select>
                  <button onClick={() => addTag(p)} style={{ fontSize: 11, cursor: 'pointer' }}>ok</button>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => togglePublish(p)} style={{ fontSize: 11, cursor: 'pointer', flex: 1 }}>
                    {p.status === 'published' ? 'Terug naar concept' : 'Publiceren'}
                  </button>
                  <button onClick={() => remove(p.id)} style={{ fontSize: 11, cursor: 'pointer' }}>&times;</button>
                </div>
              </div>
            </div>
          )
        })}
        {photos.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen foto&rsquo;s geupload.</p>}
      </div>
    </div>
  )
}
