// Basiskaart van een speelster (foto, naam, rugnummer, positie, bio, fun facts).
// Gedeeld door de spelerspagina op de site en de spelerslink voor vrienden.
export default function PlayerProfileCard({ player }) {
  return (
    <div className="yof-card" style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 72, margin: '0 auto 12px' }}>
        {player.photo_url ? (
          <img src={player.photo_url} alt="" style={{
            width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', display: 'block',
          }} />
        ) : (
          <div className="avatar" style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
          }}>
            {player.role_title || player.shirt_number || '?'}
          </div>
        )}
        {player.photo_url && (player.role_title || player.shirt_number != null) && (
          <span className="shirt-badge" style={{ fontSize: 13, minWidth: 24, height: 24 }}>{player.role_title || player.shirt_number}</span>
        )}
      </div>
      <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>{player.nickname || player.name}</h2>
      {player.nickname && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{player.name}</p>}
      <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
        {player.role_title || player.position || '-'} {!player.role_title && player.shirt_number ? `· #${player.shirt_number}` : ''}
      </p>
      {player.bio && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{player.bio}</p>}
      {player.fun_facts && (
        <p style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic' }}>&ldquo;{player.fun_facts}&rdquo;</p>
      )}
    </div>
  )
}
