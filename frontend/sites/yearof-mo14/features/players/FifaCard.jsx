import { useRef, useState, useLayoutEffect } from 'react'
import useClubLogo from '../brand/useClubLogo.js'
import usePageBlocks from '../blocks/usePageBlocks.js'
import HockeyBall from '../brand/HockeyBall.jsx'
import { STAT_KEYS, positionCode } from './fifaCardModel.js'
import './fifaCard.css'

// Spelerskaart in FIFA-stijl (goud / nacht / paris, zie temp-voorbeelden 09-10):
// links totaal, positie, clublogo, rugnummer en doelpunten dit seizoen; rechts de
// foto in de kaart; onder naam en de zes waarden. Schaalt mee met de breedte
// (--u = 1% van de gemeten breedte), dus overal te gebruiken - van raster tot spelerspagina.
export default function FifaCard({ player, card, style }) {
  const logo = useClubLogo()
  const ref = useRef(null)
  const [unit, setUnit] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setUnit(el.getBoundingClientRect().width / 100)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const variant = style || card.effective_style || 'nacht'
  const shirt = player.role_title ? null : player.shirt_number
  // Doelpunten dit seizoen: aan/uit bij Pagina-instellingen van Team
  const showGoals = usePageBlocks().setting('page.team', 'card_goals', true)
  // Onderdelen zonder waarde komen niet op de kaart (en tellen niet mee in het gemiddelde)
  const stats = STAT_KEYS.filter(k => card.stats?.[k] != null)
  return (
    <div ref={ref} className={`yof-fc yof-fc-${variant}`} style={unit ? { '--u': `${unit}px` } : undefined}>
      <div className="rim" />
      <div className="shape">
        {variant === 'paris' && <div className="tricolore" />}
        <div className="photo">
          {player.photo_url ? <img src={player.photo_url} alt="" /> : <div className="no-photo">{shirt ?? '?'}</div>}
        </div>
        <div className="rating">
          <div className="ovr">{card.overall ?? '-'}</div>
          <div className="pos">{positionCode(player)}</div>
          {logo && <div className="club"><img src={logo} alt="" /></div>}
          {shirt != null && <div className="shirtno">#{shirt}</div>}
          {showGoals && card.goals > 0 && <div className="goals" title="Doelpunten dit seizoen"><HockeyBall /> {card.goals}</div>}
        </div>
        <div className="bottom">
          <div className="name">{player.nickname || player.name}</div>
          {stats.length > 0 && <>
            <div className="divider" />
            <div className="stats" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
              {stats.map(k => <div key={k}><span className="k">{k}</span><span className="v">{card.stats[k]}</span></div>)}
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
