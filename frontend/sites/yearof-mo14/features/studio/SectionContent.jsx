import PlayersAdmin from '../../screens/PlayersAdmin.jsx'
import TimelineAdmin from '../../screens/TimelineAdmin.jsx'
import LinksAdmin from '../../screens/LinksAdmin.jsx'
import SponsorsAdmin from '../../screens/SponsorsAdmin.jsx'
import PhotosAdmin from '../../screens/PhotosAdmin.jsx'
import ReportsAdmin from '../../screens/ReportsAdmin.jsx'
import MatchAdminDetail from '../../screens/match-admin/index.jsx'
import InfoPanel from './InfoPanel.jsx'
import SpotlightAdmin from './SpotlightAdmin.jsx'
import PinnedPageAdmin from './PinnedPageAdmin.jsx'
import ActionPageAdmin from './ActionPageAdmin.jsx'
import CompetitionAdmin from './CompetitionAdmin.jsx'

// Het bewerkscherm voor 1 panel (zie studioSync.js). Gedeeld door de
// beheerstudio (groot scherm) en het tabbladenbeheer (klein scherm).
// key op de schermen met initialEditId: die lezen hun startwaarde 1x in,
// dus bij een andere speelster/bericht opnieuw mounten.
export default function SectionContent({ panel, onOpenMatch, onCloseMatch, onSelectSection }) {
  switch (panel.section) {
    case 'home':
      return <InfoPanel section={panel.section} onSelectSection={onSelectSection} />
    case 'competitie': return <CompetitionAdmin page="competition" />
    case 'topklasse': return <CompetitionAdmin page="topklasse" />
    case 'spelers':
      return <PlayersAdmin key={panel.playerId || 'list'} initialEditId={panel.playerId} />
    case 'wedstrijden':
      return panel.matchRef
        ? <MatchAdminDetail key={panel.matchRef} matchRef={panel.matchRef} onBack={onCloseMatch} />
        : <TimelineAdmin onOpenMatch={onOpenMatch} />
    case 'kijker': return <SpotlightAdmin key={panel.reportId || 'list'} initialReportId={panel.reportId} onOpenMatch={onOpenMatch} />
    case 'parijs': return <PinnedPageAdmin />
    case 'toegang': return <LinksAdmin />
    case 'fotos': return <PhotosAdmin />
    case 'verslagen': return <ReportsAdmin key={panel.reportId || 'list'} initialEditId={panel.reportId} />
    case 'actie': return <ActionPageAdmin />
    case 'sponsors': return <SponsorsAdmin />
    default: return null
  }
}
