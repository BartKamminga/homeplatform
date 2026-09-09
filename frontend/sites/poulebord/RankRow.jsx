import { C, badgeStyle } from './constants.js'
import { OnFireBadge } from './OnFireBadge.jsx'

// item 689: gedeelde bouwstenen voor "rang + logo + naam + waarde"-rijen,
// eerder apart uitgeschreven in PoolTable.jsx (tabelrij) en QueryCard.jsx
// (TeamRows/ClubRankingRows, flex-rij). Kleinschalige eerste stap richting de
// bredere Familie A/B-kaartunificatie (item 675/679), die apart wordt gepland.

export function TeamName({ name, logoUrl, showLogos, highlighted, note, streak }) {
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
      <OnFireBadge streak={streak} />
    </>
  )
}

// Flex-rij variant (QueryCard's TeamRows/ClubRankingRows): rangnummer, optioneel
// logo, naam met ellipsis, optionele tag-badges + meta-tekst, waarde rechts.
// item 1109-vervolg: tags (niveau/regio-classificatie) i.p.v. de volle
// competitienaam - zodat je bij een cross-competitie query (bv. "Alle
// niveaus") in 1 oogopslag ziet uit welke klasse een rij komt, i.p.v. een
// lange naam die de rij domineert.
export function RankRow({ rank, logoUrl, name, tags, meta, value }) {
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
      {tags?.length > 0 && (
        <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {tags.map((t, i) => <span key={t.id ?? i} style={badgeStyle()}>{t.name}</span>)}
        </span>
      )}
      {meta && <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{meta}</span>}
      <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0, minWidth: 18, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
