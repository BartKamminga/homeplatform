import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@core/api.js'

const BASE = '/api/mixmusic'

function encPath(file) {
  return file.split('/').map(encodeURIComponent).join('/')
}

const EMPTY_META = { display_name: null, rating: null, genres: [], moments: [], play_count: 0, excluded: false }

export function setExcluded(filePath, excluded) {
  return api.patch(`${BASE}/excluded/${encPath(filePath)}`, { excluded })
}

export function incrementPlay(filePath) {
  api.post(`${BASE}/play/${encPath(filePath)}`).catch(() => {})
}

export function addPlaySeconds(filePath, seconds) {
  if (!filePath || seconds < 1) return
  api.post(`${BASE}/playtime/${encPath(filePath)}`, { seconds: Math.floor(seconds) }).catch(() => {})
}

export function useTrackMeta(track) {
  const [meta, setMeta]       = useState(EMPTY_META)
  const [metaLoading, setMetaLoading] = useState(false)
  const saveTimer = useRef(null)
  const latestMeta = useRef(EMPTY_META)

  useEffect(() => {
    function load() {
      if (!track) { setMeta(EMPTY_META); return }
      setMetaLoading(true)
      api.get(`${BASE}/meta/${encPath(track.file)}`)
        .then(m => { setMeta(m); latestMeta.current = m })
        .catch(() => { setMeta({ ...EMPTY_META, file_path: track.file }) })
        .finally(() => setMetaLoading(false))
    }
    load()
    window.addEventListener('groupchange', load)
    return () => window.removeEventListener('groupchange', load)
  }, [track?.file])

  // Opruimen bij unmount — voorkomt dat debounced save vuurt op een unmounted component
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const updateMeta = useCallback((patch) => {
    const next = { ...latestMeta.current, ...patch }
    setMeta(next)
    latestMeta.current = next
    clearTimeout(saveTimer.current)
    const filePath = track?.file
    saveTimer.current = setTimeout(() => {
      if (!filePath) return
      api.patch(`${BASE}/meta/${encPath(filePath)}`, {
        display_name: next.display_name,
        rating: next.rating,
        genres: next.genres,
        moments: next.moments,
      }).catch(() => {})
    }, 300)
  }, [track?.file])

  return { meta, metaLoading, updateMeta }
}

export function useGenres() {
  const [genres, setGenres] = useState([])

  function load() {
    api.get(`${BASE}/genres`).then(setGenres).catch(() => {})
  }

  useEffect(() => { load() }, [])

  async function addGenre(name) {
    await api.post(`${BASE}/genres`, { name })
    load()
  }

  async function deleteGenre(id) {
    await api.delete(`${BASE}/genres/${id}`)
    load()
  }

  return { genres, addGenre, deleteGenre, reloadGenres: load }
}

export function useHearts(track) {
  const [hearts, setHearts]           = useState([])
  const [pendingHearts, setPendingHearts] = useState([])

  function load() {
    if (!track) { setHearts([]); setPendingHearts([]); return }
    api.get(`${BASE}/hearts/${encPath(track.file)}`).then(setHearts).catch(() => {})
  }

  useEffect(() => {
    setPendingHearts([])
    load()
    window.addEventListener('groupchange', load)
    return () => window.removeEventListener('groupchange', load)
  }, [track?.file])

  async function addHeart(position) {
    if (!track) return
    const tempId = `p_${Date.now()}`
    setPendingHearts(prev => [...prev, { id: tempId, position }])
    try {
      await api.post(`${BASE}/hearts/${encPath(track.file)}`, { position })
      load()
    } finally {
      setPendingHearts(prev => prev.filter(h => h.id !== tempId))
    }
  }

  async function removeHeart(id) {
    await api.delete(`${BASE}/hearts/${id}`)
    load()
  }

  return { hearts, pendingHearts, addHeart, removeHeart }
}

export function useMetas() {
  const [metas, setMetas] = useState({})

  function reload() {
    api.get(`${BASE}/metas`).then(setMetas).catch(() => {})
  }

  useEffect(() => {
    reload()
    window.addEventListener('groupchange', reload)
    return () => window.removeEventListener('groupchange', reload)
  }, [])

  return { metas, reloadMetas: reload }
}
