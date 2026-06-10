import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

export function useTracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/mixmusic/tracks')
      setTracks(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return { tracks, loading, error, reload: load }
}
