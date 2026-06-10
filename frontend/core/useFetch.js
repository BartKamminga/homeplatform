import { useState, useEffect, useCallback } from 'react'
import { api } from './api.js'

export function useFetch(url, { transform } = {}) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const raw = await api.get(url)
      setData(transform ? transform(raw) : raw)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
