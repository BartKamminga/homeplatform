import MatchAdminDetail from '../../screens/match-admin/index.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import { ParisHero, PARIS_PAGE_REF } from '../../screens/PinksterWeekend.jsx'

// Parijs weekend in de beheerstudio (item 1239): eigen pagina, zelfde
// bewerkscherm als een wedstrijdpagina maar zonder dag erachter.
export default function PinnedPageAdmin() {
  return (
    <div>
      <PageBlock id="paris.hero" label='Kop "Het grote Parijs-weekend"' editMode><ParisHero /></PageBlock>
      <MatchAdminDetail matchRef={PARIS_PAGE_REF} pinnedPage />
    </div>
  )
}
