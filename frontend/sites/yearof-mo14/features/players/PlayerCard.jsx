import FifaCard from './FifaCard.jsx'
import usePlayerCards from './usePlayerCards.js'

// Spelerskaart (foto, rugnummer, naam, regel eronder) - 1 tonen-component voor
// spelers: de teampagina en het doelpuntenblok. subtitle = regel onder de naam
// (standaard rol of positie). Met onClick een link, anders een gewone kaart.
// Staat haar FIFA-kaart live, dan die kaart (subtitle eronder, bv. doelpunten in deze wedstrijd).
export default function PlayerCard({ player: p, subtitle, onClick }) {
  const card = usePlayerCards()[p.id]
  const Tag = onClick ? 'a' : 'div'
  const linkProps = onClick ? { href: '#', onClick: e => { e.preventDefault(); onClick() } } : {}
  if (card) return (
    <Tag className="yof-fc-tile" {...linkProps}>
      <FifaCard player={p} card={card} />
      {subtitle && <div className="under">{subtitle}</div>}
    </Tag>
  )
  return (
    <Tag className="yof-card yof-player-card" {...linkProps}>
      <div className="photo-wrap">
        {p.photo_url
          ? <img src={p.photo_url} alt="" />
          : <div className="no-photo" style={p.role_title ? { fontSize: 14 } : undefined}>{p.role_title || p.shirt_number || '?'}</div>}
        {(p.role_title || p.shirt_number != null) && <span className="shirt-badge">{p.role_title || p.shirt_number}</span>}
      </div>
      <div className="info">
        <h3>{p.nickname || p.name}</h3>
        <div className="pos">{subtitle ?? (p.role_title || p.position || '-')}</div>
      </div>
    </Tag>
  )
}
