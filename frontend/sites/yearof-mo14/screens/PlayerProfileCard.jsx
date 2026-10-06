// Basiskaart van een speelster (foto, naam, rugnummer, positie, bio, fun facts).
// Gedeeld door de spelerspagina op de site en de spelerslink voor vrienden.
// De profielfoto staat groot bovenaan, met het rugnummer (of de rol) erover.
import FormattedText from './FormattedText.jsx'

export default function PlayerProfileCard({ player }) {
  const badge = player.role_title || player.shirt_number
  return (
    <div className="yof-card" style={{ textAlign: 'center' }}>
      <div className="yof-profile-photo">
        {player.photo_url
          ? <img src={player.photo_url} alt={player.nickname || player.name} />
          : <div className="no-photo">{badge ?? '?'}</div>}
        {player.photo_url && badge != null && <span className="shirt-badge">{badge}</span>}
      </div>
      <h2 style={{ margin: '0 0 2px', fontSize: 20 }}>{player.nickname || player.name}</h2>
      {player.nickname && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{player.name}</p>}
      <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
        {player.role_title || player.position || '-'} {!player.role_title && player.shirt_number ? `· #${player.shirt_number}` : ''}
      </p>
      {player.bio && (
        <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
          <FormattedText text={player.bio} />
        </p>
      )}
      {player.fun_facts && (
        <p style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic', overflowWrap: 'anywhere' }}>
          &ldquo;<FormattedText text={player.fun_facts} />&rdquo;
        </p>
      )}
    </div>
  )
}
