import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTracks }    from '../hooks/useTracks.js'
import { usePlayer }    from '../hooks/usePlayer.js'
import { useTrackMeta, useGenres, useMetas, useHearts, incrementPlay } from '../hooks/useTrackMeta.js'
import { useCast }      from '../hooks/useCast.js'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const { tracks, loading: tracksLoading, error, reload } = useTracks()
  const player                            = usePlayer(tracks)
  const currentTrack                      = player.currentIdx >= 0 ? tracks[player.currentIdx] : null

  const { meta, metaLoading, updateMeta } = useTrackMeta(currentTrack)
  const { genres, addGenre, deleteGenre } = useGenres()
  const { metas, reloadMetas }            = useMetas()
  const { hearts, pendingHearts, addHeart, removeHeart } = useHearts(currentTrack)
  const { castAvailable, castConnected, castTrack, openPicker: openCastPicker, stopCast } = useCast()

  const displayName = meta.display_name || null

  // Speelteller ophogen bij trackwissel
  const prevTrackFile = useRef(null)
  useEffect(() => {
    if (!currentTrack) return
    if (currentTrack.file === prevTrackFile.current) return
    prevTrackFile.current = currentTrack.file
    incrementPlay(currentTrack.file)
    setTimeout(reloadMetas, 400)
  }, [currentTrack?.file])

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
