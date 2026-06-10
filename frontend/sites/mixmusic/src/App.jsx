import { useEffect, useState } from 'react'
import { clearToken } from '@core/api.js'
import { useTracks }     from './hooks/useTracks.js'
import { usePlayer }     from './hooks/usePlayer.js'
import { useTrackMeta, useGenres, useMetas, useHearts } from './hooks/useTrackMeta.js'
import Sidebar    from './components/Sidebar.jsx'
import NowPlaying from './components/NowPlaying.jsx'
import PlayerBar  from './components/PlayerBar.jsx'
import TrackPanel from './components/TrackPanel.jsx'
import Settings   from './components/Settings.jsx'

// ── Hoofd app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return <MusicApp onOpenSettings={() => setSettingsOpen(true)} settingsOpen={settingsOpen} onCloseSettings={() => setSettingsOpen(false)} />
}

function MusicApp({ onOpenSettings, settingsOpen, onCloseSettings }) {
  const { tracks, error, reload }         = useTracks()
  const player                            = usePlayer(tracks)
  const currentTrack                      = player.currentIdx >= 0 ? tracks[player.currentIdx] : null

  const { meta, updateMeta }              = useTrackMeta(currentTrack)
  const { genres, addGenre, deleteGenre } = useGenres()
  const { metas, reloadMetas }            = useMetas()
  const { hearts, addHeart, removeHeart } = useHearts(currentTrack)

  const displayName = meta.display_name || null

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
    <>
      {settingsOpen && (
        <Settings
          onClose={onCloseSettings}
          genres={genres}
          onAddGenre={addGenre}
          onDeleteGenre={deleteGenre}
        />
      )}

      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          <Sidebar
            tracks={tracks}
            currentIdx={player.currentIdx}
            onSelect={(idx) => player.loadTrack(idx, true)}
            onReload={reload}
            metas={metas}
            onOpenSettings={onOpenSettings}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <NowPlaying
              track={currentTrack}
              playing={player.playing}
              onToggle={player.togglePlay}
              error={error}
              displayName={displayName}
              onHeart={() => addHeart(player.progress)}
              progress={player.progress}
            />
            <TrackPanel
              track={currentTrack}
              meta={meta}
              onMetaChange={handleMetaChange}
              genres={genres}
              hearts={hearts}
              onRemoveHeart={removeHeart}
              onSeek={player.seek}
              duration={player.duration}
            />
          </div>

        </div>

        <PlayerBar
          track={currentTrack}
          playing={player.playing}
          progress={player.progress}
          duration={player.duration}
          volume={player.volume}
          muted={player.muted}
          shuffle={player.shuffle}
          repeat={player.repeat}
          onToggle={player.togglePlay}
          onNext={player.next}
          onPrev={player.prev}
          onSeek={player.seek}
          onVolume={player.changeVolume}
          onMute={player.toggleMute}
          onShuffle={player.toggleShuffle}
          onRepeat={player.toggleRepeat}
        />
      </div>
    </>
  )
}
