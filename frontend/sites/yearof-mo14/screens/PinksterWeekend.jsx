import PublicEntry from './PublicEntry.jsx'
import PageBlock from '../features/blocks/PageBlock.jsx'

// Kop van de Parijs-pagina - eigen blok (live/concept, item 1239).
export function ParisHero() {
  return (
    <div className="yof-hero" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 28 }}>🗼</div>
      <h1 style={{ fontSize: 18 }}>Het grote Parijs-weekend</h1>
      <p>15-17 mei 2027 — het hoogtepunt van de hele actie.</p>
    </div>
  )
}

// Parijs weekend is een eigen pagina met eigen berichten en foto's (item 1239),
// opgeslagen onder PARIS_PAGE_REF - geen vastgepinde bijzondere dag meer.
export const PARIS_PAGE_REF = 'page:pinksterweekend'

export default function PinksterWeekend({ onBack, previewMode = false }) {
  return (
    <div>
      <PageBlock id="paris.hero"><ParisHero /></PageBlock>
      <PublicEntry matchRef={PARIS_PAGE_REF} onBack={onBack} previewMode={previewMode} />
    </div>
  )
}
