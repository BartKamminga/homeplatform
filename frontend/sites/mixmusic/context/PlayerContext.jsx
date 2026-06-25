import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTracks }    from '../hooks/useTracks.js'
import { usePlayer }    from '../hooks/usePlayer.js'
import { useTrackMeta, useGenres, useMetas, useHearts, incrementPlay, addPlaySeconds, setExcluded as apiSetExcluded } from '../hooks/useTrackMeta.js'
import { useCast }      from '../hooks/useCast.js'
import { loadUiPrefs, setUiPref } from '@core/uiPrefs.js'
import { api } from '@core/api.js'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const { tracks, loading: tracksLoading, error, reload } = useTracks()
  const player                            = usePlayer(tracks)
  const currentTrack                      = player.currentIdx >= 0 ? tracks[player.currentIdx] : null

  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    api.get('/api/auth/me').then(me => setIsAdmin(me?.pref_group_mixmusic === 'admins')).catch(() => {})
  }, [])

  const { meta, metaLoading, updateMeta } = useTrackMeta(currentTrack)
  const { genres, addGenre, deleteGenre } = useGenres()
  const { metas, reloadMetas }            = useMetas()
  const { hearts, pendingHearts, addHeart, removeHeart } = useHearts(currentTrack)
  const { castAvailable, castConnected, castTrack, openPicker: openCastPicker, stopCast } = useCast()

  const displayName = meta.display_name || null

  // Track-resume: onthoud laatste track + positie
  const LS_RESUME          = 'mm_resume'
  const BACKEND_RESUME_KEY = 'mm_resume_server'
  const restoredRef        = useRef(false)
  const pendingSeekRef     = useRef(null)    // {file, position} om te seeken zodra duration beschikbaar is
  const resumeSaveRef      = useRef(null)    // {file, position} — altijd actueel voor event-handlers
  const skipIncrementRef   = useRef(false)  // true tijdens restore → speelteller niet ophogen

  useEffect(() => {
    if (currentTrack) resumeSaveRef.current = { file: currentTrack.file, position: Math.floor(player.progress) }
  }, [currentTrack?.file, player.progress])

  // Seek uitvoeren zodra duration bekend is na restore (alleen voor de juiste track)
  useEffect(() => {
    const p = pendingSeekRef.current
    if (p && player.duration > 0 && currentTrack?.file === p.file) {
      player.seek(p.position / player.duration)
      pendingSeekRef.current = null
    }
  }, [player.duration])

  // Herstel laatste track bij opstarten (eenmalig, geen autoplay)
  // Vergelijkt localStorage met backend — gebruikt de nieuwste op basis van timestamp
  useEffect(() => {
    if (restoredRef.current || !tracks.length || player.currentIdx >= 0) return

    async function restore() {
      try {
        const lsSaved = JSON.parse(localStorage.getItem(LS_RESUME) || 'null')
        const prefs   = await loadUiPrefs()
        const beRaw   = prefs[BACKEND_RESUME_KEY]
        const beSaved = beRaw ? JSON.parse(beRaw) : null

        const lsTs  = lsSaved?.ts ?? 0
        const beTs  = beSaved?.ts ?? 0
        const saved = beTs > lsTs ? beSaved : lsSaved

        if (!saved?.file || !(saved.position > 5)) return
        const idx = tracks.findIndex(t => t.file === saved.file)
        if (idx < 0) return
        restoredRef.current      = true
        pendingSeekRef.current   = { file: saved.file, position: saved.position }
        skipIncrementRef.current = true
        player.loadTrack(idx, false)
      } catch {}
    }

    restore()
  }, [tracks])

  function saveResume() {
    const s = resumeSaveRef.current
    if (!s || !(s.position > 5)) return
    const ts      = Date.now()
    const payload = JSON.stringify({ file: s.file, position: s.position, ts })
    localStorage.setItem(LS_RESUME, payload)
    setUiPref(BACKEND_RESUME_KEY, payload)
  }

  // Opslaan bij pauze
  useEffect(() => {
    if (!player.playing) saveResume()
  }, [player.playing])

  // Opslaan bij sluiten tab/venster
  useEffect(() => {
    window.addEventListener('beforeunload', saveResume)
    return () => window.removeEventListener('beforeunload', saveResume)
  }, [])

  // Speelteller ophogen bij trackwissel (niet bij restore)
  const prevTrackFile = useRef(null)
  useEffect(() => {
    if (!currentTrack) return
    if (currentTrack.file === prevTrackFile.current) return
    prevTrackFile.current = currentTrack.file
    if (skipIncrementRef.current) { skipIncrementRef.current = false; return }
    incrementPlay(currentTrack.file)
    setTimeout(reloadMetas, 400)
  }, [currentTrack?.file])

  // Speelduur bijhouden — flush bij pauze/trackwissel en elke 30s
  const playStartRef  = useRef(null)   // Date.now() van laatste play-start
  const playFileRef   = useRef(null)   // track waarvoor we meten

  function flushPlaySeconds() {
    if (playStartRef.current && playFileRef.current) {
      const elapsed = Math.floor((Date.now() - playStartRef.current) / 1000)
      addPlaySeconds(playFileRef.current, elapsed)
      playStartRef.current = Date.now()
      saveResume()  // sync positie naar backend tijdens afspelen
    }
  }

  useEffect(() => {
    if (player.playing && currentTrack) {
      if (!playStartRef.current) playStartRef.current = Date.now()
      playFileRef.current = currentTrack.file
    } else {
      flushPlaySeconds()
      playStartRef.current = null
    }
  }, [player.playing])

  useEffect(() => {
    // Bij trackwissel: flush vorige track, reset timer
    flushPlaySeconds()
    playStartRef.current = player.playing ? Date.now() : null
    playFileRef.current  = currentTrack?.file ?? null
  }, [currentTrack?.file])

  useEffect(() => {
    // Periodieke flush elke 30s tijdens afspelen
    const id = setInterval(() => { if (player.playing) flushPlaySeconds() }, 30_000)
    return () => clearInterval(id)
  }, [player.playing, currentTrack?.file])

  // Auto-cast wanneer track wisselt terwijl Cast verbonden is
  useEffect(() => {
    if (castConnected && currentTrack) {
      castTrack(currentTrack, displayName)
    }
  }, [currentTrack?.file, castConnected])

  function handleMetaChange(patch) {
    updateMeta(patch)
    setTimeout(reloadMetas, 400)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT') return
      if (e.code === 'Space')      { e.preventDefault(); player.togglePlay() }
      if (e.code === 'ArrowRight') player.seek((player.progress + 10) / Math.max(player.duration, 1))
      if (e.code === 'ArrowLeft')  player.seek(Math.max(0, player.progress - 10) / Math.max(player.duration, 1))
      if (e.code === 'ArrowUp')    player.changeVolume(Math.min(1, player.volume + 0.1))
      if (e.code === 'ArrowDown')  player.changeVolume(Math.max(0, player.volume - 0.1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  // Media Session — lockscreen metadata + controls
  const msProgressRef = useRef(0)
  const msDurationRef = useRef(0)
  useEffect(() => { msProgressRef.current = player.progress }, [player.progress])
  useEffect(() => { msDurationRef.current = player.duration }, [player.duration])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayName || currentTrack.name,
      artist: currentTrack.folder || 'Mix Music',
      album: 'Mix Music',
      artwork: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
    })
  }, [currentTrack?.file, displayName])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused'
  }, [player.playing])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => player.togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => player.togglePlay())
    navigator.mediaSession.setActionHandler('previoustrack', () => player.prev())
    navigator.mediaSession.setActionHandler('nexttrack', () => player.next())
    navigator.mediaSession.setActionHandler('seekbackward', (e) => {
      const off = e.seekOffset ?? 10
      player.seek(Math.max(0, msProgressRef.current - off) / Math.max(msDurationRef.current, 1))
    })
    navigator.mediaSession.setActionHandler('seekforward', (e) => {
      const off = e.seekOffset ?? 10
      player.seek(Math.min(msDurationRef.current, msProgressRef.current + off) / Math.max(msDurationRef.current, 1))
    })
    return () => {
      ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward']
        .forEach(a => navigator.mediaSession.setActionHandler(a, null))
    }
  }, [player.togglePlay, player.prev, player.next, player.seek])

  useEffect(() => {
    if (!('mediaSession' in navigator) || player.duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({
        duration: player.duration,
        playbackRate: 1,
        position: Math.min(player.progress, player.duration),
      })
    } catch {}
  }, [player.progress, player.duration])

  async function toggleExcluded(filePath, excluded) {
    await apiSetExcluded(filePath, excluded)
    setTimeout(reloadMetas, 200)
  }

  return (
    <PlayerContext.Provider value={{
      // tracks
      tracks, tracksLoading, error, reload,
      // meta loading
      metaLoading,
      // player
      ...player,
      currentTrack,
      // meta
      meta, displayName, handleMetaChange,
      // genres
      genres, addGenre, deleteGenre,
      // hearts
      hearts, pendingHearts,
      addHeart: async (position) => { await addHeart(position); setTimeout(reloadMetas, 300) },
      removeHeart: async (id) => { await removeHeart(id); setTimeout(reloadMetas, 300) },
      // bulk metas (for sidebar ratings)
      metas, reloadMetas,
      // cast
      castAvailable, castConnected, openCastPicker, stopCast,
      // admin
      isAdmin, toggleExcluded,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayerContext() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayerContext must be used inside PlayerProvider')
  return ctx
}
