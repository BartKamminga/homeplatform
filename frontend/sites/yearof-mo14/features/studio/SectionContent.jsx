import PlayersAdmin from '../../screens/PlayersAdmin.jsx'
import TimelineAdmin from '../../screens/TimelineAdmin.jsx'
import LinksAdmin from '../../screens/LinksAdmin.jsx'
import SponsorsAdmin from '../../screens/SponsorsAdmin.jsx'
import PhotosAdmin from '../../screens/PhotosAdmin.jsx'
import MatchAdminDetail from '../../screens/match-admin/index.jsx'
import PublicHome from '../../screens/PublicHome.jsx'
import ReportsManager from '../reports/ReportsManager.jsx'
import { SPOTLIGHT_PAGE, viewForPageRef } from '../pages/useCustomPages.js'
import CustomPageAdmin from '../pages/CustomPageAdmin.jsx'
import ActionPageAdmin from './ActionPageAdmin.jsx'
import TimelineBlocksAdmin from './TimelineBlocksAdmin.jsx'
import PageSwitch, { PAGES } from '../blocks/PageSwitch.jsx'
import CompetitionAdmin from './CompetitionAdmin.jsx'
import PageSettingsCard from '../pages/PageSettingsCard.jsx'
import usePageMeta, { SECTION_VIEW } from '../pages/pageMeta.js'

// Het bewerkscherm voor 1 panel (zie studioSync.js). Gedeeld door de
// beheerstudio (groot scherm) en het tabbladenbeheer (klein scherm).
// key op de schermen met initialEditId: die lezen hun startwaarde 1x in,
// dus bij een andere speelster/bericht opnieuw mounten.
export default function SectionContent(props) {
  const { panel } = props
  // Pagina's in het menu: bovenaan live/concept voor de hele pagina (item 1239).
  const page = PAGES[panel.section]
  const onPage = !(panel.section === 'wedstrijden' && panel.matchRef)
  // Naam/icoon/titel/ondertitel van elke vaste pagina, ingeklapt (item 1248).
  const view = SECTION_VIEW[panel.section]
  const meta = usePageMeta()
  return (
    <>
      {page && onPage && <PageSwitch id={page.id} label={meta(view).label} />}
      {/* Competitie/Topklasse: hun live-balk staat in de pagina zelf, de instellingen daaronder (zie CompetitionTab) */}
      {view && onPage && !['competition', 'topklasse'].includes(view) && <PageSettingsCard key={view} view={view} />}
      <SectionBody {...props} spotlightPage={{ ...SPOTLIGHT_PAGE, ...meta('spotlight') }} />
    </>
  )
}

function SectionBody({ panel, onOpenMatch, onCloseMatch, onSelectSection, spotlightPage }) {
  if (panel.section.startsWith('custom:')) {
    const id = panel.section.slice(7)
    return <CustomPageAdmin key={id} pageId={id} onDeleted={() => onSelectSection('home')} />
  }
  switch (panel.section) {
    case 'home':
      // Home zoals op de site, per blok live/concept; de blokken worden elders bewerkt.
      return <PublicHome editMode onOpenMatch={onOpenMatch} onOpenPlayer={() => onSelectSection('spelers')}
        onNavigate={page => onSelectSection(page === 'spotlight' ? 'kijker' : 'wedstrijden')}
        onOpenPage={ref => { const v = viewForPageRef(ref); if (v) onSelectSection(v.name === 'spotlight' ? 'kijker' : `custom:${v.id}`) }} />
    case 'competitie': return <CompetitionAdmin page="competition" />
    case 'topklasse': return <CompetitionAdmin page="topklasse" />
    case 'spelers':
      return <PlayersAdmin key={panel.playerId || 'list'} initialEditId={panel.playerId} />
    case 'wedstrijden':
      return panel.matchRef
        ? <MatchAdminDetail key={panel.matchRef} matchRef={panel.matchRef} onBack={onCloseMatch} />
        : <TimelineAdmin onOpenMatch={onOpenMatch} footer={<TimelineBlocksAdmin />} />
    case 'kijker': return <CustomPageAdmin fixedPage={spotlightPage} />
    case 'toegang': return <LinksAdmin />
    case 'fotobeheer': return <PhotosAdmin />
    case 'berichten': return <ReportsManager />
    case 'upload':
      return <p style={{ fontSize: 13, color: '#666' }}>Op deze pagina uploadt het team foto&rsquo;s met de sitelink. Hij verdwijnt zodra uploaden alleen nog via een link gaat (item 1242). Alle foto&rsquo;s beheer je onder Foto&rsquo;s.</p>
    case 'actie': return <ActionPageAdmin />
    case 'sponsors': return <SponsorsAdmin />
    default: return null
  }
}
