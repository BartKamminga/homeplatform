import PageBlock from '../blocks/PageBlock.jsx'
import ActionAdmin from '../../screens/ActionAdmin.jsx'
import SponsorsAdmin from '../../screens/SponsorsAdmin.jsx'

// Actie in de beheerstudio (item 1239): dezelfde blokken als de pagina, elk
// met live/concept en direct te bewerken.
export default function ActionPageAdmin() {
  return (
    <div>
      <PageBlock id="action.thermometer" label="Thermometer en donatielink" editMode><ActionAdmin /></PageBlock>
      <PageBlock id="action.sponsors" label="Sponsors" editMode><SponsorsAdmin /></PageBlock>
    </div>
  )
}
