import useClubLogo from '../brand/useClubLogo.js'
import { STAT_KEYS, positionCode } from './fifaCardModel.js'
import './fifaCard.css'

// Spelerskaart in FIFA-stijl (goud / nacht / paris, zie temp-voorbeelden 09-10):
// links totaal, positie, clublogo, rugnummer en doelpunten dit seizoen; rechts de
// foto in de kaart; onder naam en de zes waarden. Schaalt mee met de breedte
// (container query units), dus overal te gebruiken - van raster tot spelerspagina.
export default function FifaCard({ player, card, style }) {
  const logo = useClubLogo()
  const variant = style || card.effective_style || 'nacht'
  const shirt = player.role_title ? null : player.shirt_number
  return (
    <div className={`yof-fc yof-fc-${variant}`}>
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
          {card.goals > 0 && <div className="goals" title="Doelpunten dit seizoen">⚽{card.goals}</div>}
        </div>
        <div className="bottom">
          <div className="name">{player.nickname || player.name}</div>
          <div className="divider" />
          <div className="stats">
            {STAT_KEYS.map(k => (
              <div key={k}><span className="k">{k}</span><span className="v">{card.stats?.[k] ?? '-'}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
