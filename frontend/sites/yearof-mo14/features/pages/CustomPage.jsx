import PublicEntry from '../../screens/PublicEntry.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import { pageRef } from './useCustomPages.js'

// Kop van een eigen pagina (icoon, titel, ondertitel) - eigen blok "hero.<id>".
export function PageHero({ page }) {
  if (!page.title && !page.subtitle && !page.icon) return null
  return (
    <div className="yof-hero" style={{ marginBottom: 14 }}>
      {page.icon && <div style={{ fontSize: 28 }}>{page.icon}</div>}
      {page.title && <h1 style={{ fontSize: 18 }}>{page.title}</h1>}
      {page.subtitle && <p>{page.subtitle}</p>}
    </div>
  )
}

// Eigen pagina (item 1239), bv. Parijs weekend of een toernooi: kop + eigen
// berichten en foto's onder "page:<id>".
export default function CustomPage({ page, onBack, previewMode = false }) {
  return (
    <div>
      <PageBlock id={`hero.${page.id}`}><PageHero page={page} /></PageBlock>
      <PublicEntry matchRef={pageRef(page.id)} onBack={onBack} previewMode={previewMode} />
    </div>
  )
}
