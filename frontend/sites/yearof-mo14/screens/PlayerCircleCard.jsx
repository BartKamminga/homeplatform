// "Rond <naam>"-kaart (item 1185): ouders, buddy en coaches van een speelster.
// Alleen op de volledige site (sitelink) - niet via de spelerslink voor vrienden.
// Verschijnt alleen als minstens 1 veld is ingevuld (bv. niet bij begeleiders).
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
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', gap: 10, fontSize: 14, padding: '4px 0' }}>
          <span style={{ width: 70, flexShrink: 0, color: '#666', fontSize: 13 }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  )
}
