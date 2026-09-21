import { useState, useEffect } from 'react'
import { getPhotosModeration, updatePhoto, deletePhoto, getTimelineModeration, getPlayers, tagPhoto, untagPhoto } from '../api.js'
import { PhotoModerationGrid } from './PhotoModerationGrid.jsx'

export default function PhotosAdmin() {
  const [photos, setPhotos] = useState([])
  const [entries, setEntries] = useState([])
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')

  function load() {
    getPhotosModeration().then(setPhotos).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    getTimelineModeration().then(setEntries).catch(() => {})
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

  async function saveCaption(photo, value) {
    try {
      await updatePhoto(photo.id, { caption: value })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleHighlight(photo) {
    try {
      await updatePhoto(photo.id, { match_highlight: !photo.match_highlight })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function bulkPublish(ids) {
    try {
      await Promise.all(ids.map(id => updatePhoto(id, { status: 'published' })))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function bulkDelete(ids) {
    try {
      await Promise.all(ids.map(id => deletePhoto(id)))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Foto&rsquo;s modereren</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <PhotoModerationGrid photos={photos} players={players} entryTitle={entryTitle}
        onTogglePublish={togglePublish} onDelete={remove} onToggleTag={toggleTag} onSaveCaption={saveCaption}
        onToggleHighlight={toggleHighlight} onBulkPublish={bulkPublish} onBulkDelete={bulkDelete} />
    </div>
  )
}
