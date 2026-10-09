// Spelerskaart (foto, rugnummer, naam, regel eronder) - 1 tonen-component voor
// spelers: de teampagina en het doelpuntenblok. subtitle = regel onder de naam
// (standaard rol of positie). Met onClick een link, anders een gewone kaart.
export default function PlayerCard({ player: p, subtitle, onClick }) {
  const Tag = onClick ? 'a' : 'div'
  const linkProps = onClick ? { href: '#', onClick: e => { e.preventDefault(); onClick() } } : {}
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
