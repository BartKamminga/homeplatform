import FeatureFlagBar from './FeatureFlagBar.jsx'
import PositionChances from './PositionChances.jsx'
import PouleResults from './PouleResults.jsx'
import RegroupingForecast from './RegroupingForecast.jsx'

// Tab "Competitie" (items 1229, 1231, 1232): alles rond het eigen team -
// kans op eindplek, uitslagen/programma in de eigen poule en de
// herindelingsprognose. De bredere landelijke blik staat op de tab
// Topklasse. Beide achter dezelfde featureflag (FeatureFlagBar).
export default function CompetitionTab({ access }) {
  const { config } = access
  if (!config) return null
  return (
    <div>
      <FeatureFlagBar access={access} />
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Competitie{config.poule_name ? ` · ${config.poule_name}` : ''}</h2>
      <PositionChances pouleId={config.poule_id} teamId={config.team_id} />
      <PouleResults pouleId={config.poule_id} teamName={config.team_name} />
      <RegroupingForecast tournamentId={config.tournament_id} teamId={config.team_id} />
    </div>
  )
}
