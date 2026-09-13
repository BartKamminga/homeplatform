import { useState, useEffect } from 'react'
import { getPhotosModeration, updatePhoto, deletePhoto } from '../api.js'

export default function PhotosAdmin() {
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')

  function load() {
    getPhotosModeration().then(setPhotos).catch(e => setError(e.message))
  }
  useEffect(load, [])

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

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Foto&rsquo;s modereren</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {photos.map(p => (
          <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
            <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#eee' }} />
            <div style={{ padding: 8, fontSize: 11 }}>
              <div style={{ color: p.status === 'published' ? '#16a34a' : '#d97706', fontWeight: 700, marginBottom: 4 }}>
                {p.status === 'published' ? 'Gepubliceerd' : 'Concept'}
              </div>
              <div style={{ color: '#888', marginBottom: 6 }}>{p.photo_type} &middot; {p.match_ref}</div>
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
