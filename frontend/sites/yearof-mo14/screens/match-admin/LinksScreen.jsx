import { ExistingLinksEditor } from '../ReportLinks.jsx'

export const LINKS_BLOCK_META = {
  instagram: { title: 'Instagram', linkType: 'instagram' },
  wedstrijd_beelden: { title: 'Wedstrijdbeelden', linkType: 'video' },
}

// Bewerkscherm van een Instagram-/Wedstrijdbeelden-blok: alleen de lijst met
// linkjes (type volgt uit het blok). Het blok zelf wordt aangemaakt via de
// keuzebalk; live/concept, wedstrijdlink, volgorde en verwijderen staan op het
// blok op de wedstrijdpagina (item 1239).
export function LinksScreen({ reportType, existingReport, onBack, onRefresh }) {
  const meta = LINKS_BLOCK_META[reportType]
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>{meta.title}</h3>
      <ExistingLinksEditor reportId={existingReport.id} links={existingReport.links || []} onChanged={onRefresh} fixedType={meta.linkType} />
    </div>
  )
}
