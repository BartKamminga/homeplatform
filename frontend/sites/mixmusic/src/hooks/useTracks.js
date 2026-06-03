import { useState, useEffect } from 'react'

export function useTracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mixmusic/tracks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
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
