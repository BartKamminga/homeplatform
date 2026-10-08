import NationalQueries from '../../screens/NationalQueries.jsx'
import FeatureFlagBar from './FeatureFlagBar.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import TopklasseOverview from './TopklasseOverview.jsx'
import RegroupingFull from './RegroupingFull.jsx'
import PageTitle from '../pages/PageTitle.jsx'

// Tab "Topklasse" (item 1230): de bredere, landelijke blik op de hele MO14
// Topklasse - alle poules per district, de hele herindelingsprognose en de
// landelijke ranglijst/belangrijke wedstrijden. Het eigen team staat op de
// tab Competitie. Elk blok apart live/concept (PageBlock, item 1239).
export default function TopklasseTab({ access, editMode = false }) {
  const { config } = access
  if (!config) return null
  const block = (id, label, el) => <PageBlock id={id} label={label} editMode={editMode}>{el}</PageBlock>
  return (
    <div>
      {editMode && <FeatureFlagBar access={access} page="topklasse" />}
      <PageTitle view="topklasse" />
      {block('topklasse.overview', 'Alle Topklasse-poules', <TopklasseOverview tournamentId={config.tournament_id} teamId={config.team_id} />)}
      {block('topklasse.regrouping', 'Volledige herindeling', <RegroupingFull tournamentId={config.tournament_id} teamId={config.team_id} />)}
      {block('topklasse.national', 'Landelijke ranglijst en belangrijke wedstrijden', <NationalQueries />)}
    </div>
  )
}
