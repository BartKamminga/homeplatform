// Muziekbalk onderin de HUD (B = aan/uit, N = volgende) + de regelaar: start de muziek bij het begin van een rit
// (als MUSIC aan staat) en laat filter/volume/mixkeuze 4x/s de inspanning volgen.
import { useEffect, useRef } from 'react'
import { useVbt, isRiding } from '../../hooks/useVbt.js'
import { useMusic, start, next, toggle, follow, getState } from './music.js'

export function MusicController() {
  const s = useVbt()
  const was = useRef(false)
  const riding = isRiding(s.state)
  useEffect(() => {
    if (riding && !was.current && s.settings?.musicOn !== false && getState().status !== 'playing') start('ride')
    was.current = riding
  }, [riding])
  useEffect(() => { follow(s) })
  return null
}

export default function MusicBar() {
  const m = useMusic()
  if (m.status === 'off' && !m.title) {
    return (
      <div id="music" className="off">
        <button onClick={toggle} title="Music on (B)">&#9835; MUSIC <em>B</em></button>
      </div>
    )
  }
  const tier = m.tier === 2 ? 'HIGH ENERGY' : m.tier === 0 ? 'CHILL' : ''
  return (
    <div id="music" className={m.status}>
      <span className="mtitle">&#9835; {m.status === 'playing' ? m.title.toUpperCase() : m.error ? m.error.toUpperCase() : 'MUSIC OFF'}
        {tier && m.status === 'playing' && <i>{tier}</i>}</span>
      <button id="musicToggle" onClick={toggle} title="Music on/off (B)">{m.status === 'playing' ? '⏸' : '▶'}</button>
      <button id="musicNext" onClick={next} title="Next mix (N)">&#9197;</button>
    </div>
  )
}
