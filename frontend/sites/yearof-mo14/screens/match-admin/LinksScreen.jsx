import { ExistingLinksEditor } from '../ReportLinks.jsx'

export const LINKS_BLOCK_META = {
  instagram: { title: 'Instagram', linkType: 'instagram' },
  wedstrijd_beelden: { title: 'Wedstrijdbeelden', linkType: 'video' },
}

// Editor van een Instagram-/Wedstrijdbeelden-blok, in het blok zelf (item 1258):
// alleen de lijst met linkjes (type volgt uit het blok); elke wijziging slaat
// meteen op, dus alleen een knop Klaar. Het blok zelf wordt aangemaakt via de
// keuzebalk; live/concept, wedstrijdlink, volgorde en verwijderen staan op de
// balk boven het blok (item 1239).
export function LinksScreen({ reportType, existingReport, onDone, onRefresh }) {
  const meta = LINKS_BLOCK_META[reportType]
  return (
    <div className="yof-card" style={{ marginBottom: 10 }}>
      <ExistingLinksEditor reportId={existingReport.id} links={existingReport.links || []} onChanged={onRefresh} fixedType={meta.linkType} />
      <button className="yof-btn" onClick={onDone} style={{ marginTop: 10 }}>Klaar</button>
    </div>
  )
}
