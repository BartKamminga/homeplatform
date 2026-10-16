// WORLD in SETTINGS (item 1366): kies de game-wereld (OutRun, Grid, Pixel Alps). Werkt meteen, ook in het
// titelscherm op de achtergrond; wordt bewaard in je instellingen.
import { useVbt, actions } from '../../hooks/useVbt.js'

export default function WorldBlock() {
  const cur = useVbt(s => s.settings?.world) || 'outrun'
  const pick = id => {
    actions().saveSettings({ world: id })
    window.VBT.worlds.apply(id)
  }
  return (
    <>
      <h4>WORLD</h4>
      <div className="pn-worlds">
        {window.VBT.worlds.list().map(w => (
          <button key={w.id} id={'world-' + w.id} className={'ghostbtn' + (cur === w.id ? ' active' : '')} onClick={() => pick(w.id)}>
            <b>{w.name.toUpperCase()}</b><small>{w.desc}</small>
          </button>
        ))}
      </div>
    </>
  )
}
