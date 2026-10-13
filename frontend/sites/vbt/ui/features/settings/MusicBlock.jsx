// MUSIC in SETTINGS: muziek uit MixMusic aan/uit bij het rijden, volume en 'volg de inspanning'
import { useVbt, actions } from '../../hooks/useVbt.js'
import { useMusic, toggle, next } from '../music/music.js'

export default function MusicBlock() {
  const st = useVbt(s => s.settings) || {}
  const m = useMusic()
  const save = patch => actions().saveSettings(patch)
  return (
    <>
      <h4>MUSIC (MIXMUSIC)</h4>
      <label className="pn-toggle"><input type="checkbox" checked={st.musicOn !== false} onChange={e => save({ musicOn: e.target.checked })} />
        Play a random mix when a ride starts</label>
      <label className="pn-toggle"><input type="checkbox" checked={st.musicFollow !== false} onChange={e => save({ musicFollow: e.target.checked })} />
        Music follows your effort (muffled when easy, full and loud from threshold; energetic mix on hard blocks)</label>
      <label className="pn-field"><small>VOLUME</small>
        <input id="musicVolume" type="range" min="0" max="100" value={st.musicVolume ?? 70} onChange={e => save({ musicVolume: +e.target.value })} /></label>
      <div className="pn-buttons">
        <button className="ghostbtn" onClick={toggle}>{m.status === 'playing' ? '⏸ PAUSE' : '▶ PLAY'} <em>B</em></button>
        <button className="ghostbtn" onClick={next}>&#9197; NEXT MIX <em>N</em></button>
      </div>
      {m.title && <p className="pn-hint">Now: {m.title}{m.error ? ' - ' + m.error : ''}</p>}
    </>
  )
}
