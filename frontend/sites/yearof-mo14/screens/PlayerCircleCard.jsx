// "Rond <naam>"-kaart (item 1185): wat ouders, buddy en coaches over een
// speelster zeggen. Op de spelerspagina van de site en op de spelerslink.
// Tekst over de volle breedte, afzender klein eronder (zoals een citaat).
// Verschijnt alleen als minstens 1 veld is ingevuld (bv. niet bij begeleiders).
import FormattedText from './FormattedText.jsx'

export default function PlayerCircleCard({ player }) {
  const rows = [
    ['Ouders', player.parents],
    ['Buddy', player.buddy],
    ['Coaches', player.coaches],
  ].filter(([, value]) => value && value.trim())

  if (rows.length === 0) return null

  return (
    <div className="yof-card" style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Rond {player.nickname || player.name}</h3>
      {rows.map(([label, value], i) => (
        <div key={label} style={{ marginTop: i === 0 ? 0 : 14 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}><FormattedText text={value} /></p>
          <div style={{ marginTop: 4, fontSize: 12, color: '#999', fontStyle: 'italic' }}>&mdash; {label}</div>
        </div>
      ))}
    </div>
  )
}
