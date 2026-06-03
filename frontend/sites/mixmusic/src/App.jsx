import { useEffect } from 'react'
import { useTracks } from './hooks/useTracks.js'
import { usePlayer } from './hooks/usePlayer.js'
import Sidebar     from './components/Sidebar.jsx'
import NowPlaying  from './components/NowPlaying.jsx'
import PlayerBar   from './components/PlayerBar.jsx'

export default function App() {
  const { tracks, error, reload } = useTracks()
  const player = usePlayer(tracks)

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT') return
      if (e.code === 'Space')       { e.preventDefault(); player.togglePlay() }
      if (e.code === 'ArrowRight')  player.seek((player.progress + 10) / Math.max(player.duration, 1))
      if (e.code === 'ArrowLeft')   player.seek(Math.max(0, player.progress - 10) / Math.max(player.duration, 1))
      if (e.code === 'ArrowUp')     player.changeVolume(Math.min(1, player.volume + 0.1))
      if (e.code === 'ArrowDown')   player.changeVolume(Math.max(0, player.volume - 0.1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  const currentTrack = player.currentIdx >= 0 ? tracks[player.currentIdx] : null

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          tracks={tracks}
          currentIdx={player.currentIdx}
          onSelect={(idx) => player.loadTrack(idx, true)}
          onReload={reload}
        />
        <NowPlaying
          track={currentTrack}
          playing={player.playing}
          onToggle={player.togglePlay}
          error={error}
        />
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
  )
}
