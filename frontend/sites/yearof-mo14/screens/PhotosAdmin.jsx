import { useState, useEffect } from 'react'
import { getPhotosModeration, updatePhoto, deletePhoto, getTimeline, getPlayers, tagPhoto, untagPhoto } from '../api.js'

export default function PhotosAdmin() {
  const [photos, setPhotos] = useState([])
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')
  const [captionDraft, setCaptionDraft] = useState({}) // photoId -> tekst in bewerking

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

  async function toggleTag(photo, playerId) {
    try {
      if (photo.player_ids.includes(playerId)) {
        await untagPhoto(photo.id, playerId)
      } else {
        await tagPhoto(photo.id, playerId)
      }
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function saveCaption(photo) {
    const value = captionDraft[photo.id]
    if (value === undefined || value === (photo.caption || '')) return
    try {
      await updatePhoto(photo.id, { caption: value })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Foto&rsquo;s modereren</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {photos.map(p => (
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
                {players.map(pl => {
                  const tagged = p.player_ids.includes(pl.id)
                  return (
                    <button key={pl.id} onClick={() => toggleTag(p, pl.id)}
                      style={{
                        border: 'none', borderRadius: 999, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                        background: tagged ? '#16a34a' : '#e5e7eb',
                        color: tagged ? 'white' : '#555',
                      }}>
                      {pl.nickname || pl.name}
                    </button>
                  )
                })}
              </div>

              <input
                placeholder="Notitie (optioneel)"
                defaultValue={p.caption || ''}
                onChange={e => setCaptionDraft({ ...captionDraft, [p.id]: e.target.value })}
                onBlur={() => saveCaption(p)}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 6 }}
              />

              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => togglePublish(p)} style={{ fontSize: 11, cursor: 'pointer', flex: 1 }}>
                  {p.status === 'published' ? 'Terug naar concept' : 'Publiceren'}
                </button>
                <button onClick={() => remove(p.id)} style={{ fontSize: 11, cursor: 'pointer' }}>&times;</button>
              </div>
            </div>
          </div>
        ))}
        {photos.length === 0 && !error && <p style={{ color: '#666', fontSize: 13 }}>Nog geen foto&rsquo;s geupload.</p>}
      </div>
    </div>
  )
}
