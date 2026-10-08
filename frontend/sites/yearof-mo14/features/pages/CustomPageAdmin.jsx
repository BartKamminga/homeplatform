import { deleteCustomPage } from '../../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import MatchAdminDetail from '../../screens/match-admin/index.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import PageSwitch from '../blocks/PageSwitch.jsx'
import useCustomPages, { pageRef } from './useCustomPages.js'
import { PageHero } from './CustomPage.jsx'
import PageSettingsCard from './PageSettingsCard.jsx'

// Eigen pagina in de beheerstudio (item 1239): live/concept, menunaam en kop,
// en de berichten/foto's zoals op een wedstrijdpagina (zonder wedstrijd erachter).
// fixedPage (In de kijker, item 1241): vaste pagina - niet te verwijderen; live/concept
// en de pagina-instellingen staan dan al bovenaan het bewerkscherm (SectionContent).
export default function CustomPageAdmin({ pageId, fixedPage, onDeleted }) {
  const custom = useCustomPages().find(p => p.id === pageId)
  const page = fixedPage || custom
  const [confirm, confirmDialog] = useConfirm()

  if (!page) return null

  async function remove() {
    if (!(await confirm(`Pagina "${page.label}" verwijderen? Hij verdwijnt uit het menu; de berichten en foto's blijven bewaard maar zijn niet meer zichtbaar.`))) return
    await deleteCustomPage(page.id)
    onDeleted()
  }

  return (
    <div>
      {confirmDialog}
      {!fixedPage && <PageSwitch id={`page.${page.id}`} label={page.label} />}

      {!fixedPage && <PageSettingsCard key={page.id} customPage={page} onDelete={remove} />}

      <PageBlock id={`hero.${page.id}`} label="Kop" editMode><PageHero page={page} /></PageBlock>
      <MatchAdminDetail key={page.id} matchRef={pageRef(page.id)} pinnedPage pageTitle={page.label} />
    </div>
  )
}
