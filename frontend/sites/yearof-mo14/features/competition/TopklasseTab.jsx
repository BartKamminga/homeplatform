import NationalQueries from '../../screens/NationalQueries.jsx'
import FeatureFlagBar from './FeatureFlagBar.jsx'
import TopklasseOverview from './TopklasseOverview.jsx'

// Tab "Topklasse" (item 1230): de bredere, landelijke blik op de hele MO14
// Topklasse - alle poules per district + landelijke ranglijst en belangrijke
// wedstrijden. Het eigen team staat op de tab Competitie.
export default function TopklasseTab({ access }) {
  const { config } = access
  if (!config) return null
  return (
    <div>
      <FeatureFlagBar access={access} />
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Topklasse MO14 landelijk</h2>
      <TopklasseOverview tournamentId={config.tournament_id} teamId={config.team_id} />
      <NationalQueries />
    </div>
  )
}
