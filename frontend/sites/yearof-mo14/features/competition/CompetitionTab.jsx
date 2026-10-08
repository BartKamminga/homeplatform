import FeatureFlagBar from './FeatureFlagBar.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import PositionChances from './PositionChances.jsx'
import PouleResults from './PouleResults.jsx'
import RegroupingForecast from './RegroupingForecast.jsx'

// Tab "Competitie" (items 1229, 1231, 1232): alles rond het eigen team -
// kans op eindplek, uitslagen/programma in de eigen poule en de
// herindelingsprognose. De bredere landelijke blik staat op de tab
// Topklasse. Elke tab een eigen featureflag (FeatureFlagBar); elk blok
// apart live/concept (PageBlock, item 1239). editMode = beheerstudio.
export default function CompetitionTab({ access, editMode = false }) {
  const { config } = access
  if (!config) return null
  const block = (id, label, el) => <PageBlock id={id} label={label} editMode={editMode}>{el}</PageBlock>
  return (
    <div>
      {editMode && <FeatureFlagBar access={access} page="competition" />}
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Competitie{config.poule_name ? ` · ${config.poule_name}` : ''}</h2>
      {block('competition.chances', 'Kans op elke eindplek', <PositionChances pouleId={config.poule_id} teamId={config.team_id} />)}
      {block('competition.results', 'Uitslagen en programma', <PouleResults pouleId={config.poule_id} teamName={config.team_name} />)}
      {block('competition.regrouping', 'Herindelingsprognose', <RegroupingForecast tournamentId={config.tournament_id} teamId={config.team_id} />)}
    </div>
  )
}
