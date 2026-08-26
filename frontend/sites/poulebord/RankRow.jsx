import { C } from './constants.js'

// item 689: gedeelde bouwstenen voor "rang + logo + naam + waarde"-rijen,
// eerder apart uitgeschreven in PoolTable.jsx (tabelrij) en QueryCard.jsx
// (TeamRows/ClubRankingRows, flex-rij). Kleinschalige eerste stap richting de
// bredere Familie A/B-kaartunificatie (item 675/679), die apart wordt gepland.

export function TeamName({ name, logoUrl, showLogos, highlighted, note }) {
  return (
    <>
      {showLogos && logoUrl && (
        <img src={logoUrl} alt="" style={{
          width: 14, height: 14, borderRadius: '50%', objectFit: 'cover',
          marginRight: 4, verticalAlign: 'middle', flexShrink: 0,
        }} />
      )}
      {highlighted && <span style={{ marginRight: 3, fontSize: 8 }}>▶</span>}
      {name}
      {note && <span title={note} style={{ marginLeft: 4, fontSize: 10, cursor: 'help', opacity: 0.75 }}>💬</span>}
    </>
  )
}

// Flex-rij variant (QueryCard's TeamRows/ClubRankingRows): rangnummer, optioneel
// logo, naam met ellipsis, optionele meta-tekst, waarde rechts.
export function RankRow({ rank, logoUrl, name, meta, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      borderBottom: `1px solid ${C.border}`, fontSize: 12,
    }}>
      <span style={{ color: C.muted, width: 14, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      <span style={{ flex: 1, minWidth: 0, color: C.chalk,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <TeamName name={name} logoUrl={logoUrl} showLogos={true} />
      </span>
      {meta && <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{meta}</span>}
      <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0, minWidth: 18, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
