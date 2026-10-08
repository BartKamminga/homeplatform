import FeatureFlagBar from './FeatureFlagBar.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import PositionChances from './PositionChances.jsx'
import CompetitionStandings from './CompetitionStandings.jsx'
import PouleResults from './PouleResults.jsx'
import RegroupingForecast from './RegroupingForecast.jsx'
import PageTitle from '../pages/PageTitle.jsx'

// Tab "Competitie" (items 1229, 1231, 1232): alles rond het eigen team -
// kans op eindplek, uitslagen/programma in de eigen poule en de
// herindelingsprognose. De bredere landelijke blik staat op de tab
// Topklasse. Elke tab een eigen featureflag (FeatureFlagBar); elk blok
// apart live/concept (PageBlock, item 1239). editMode = beheerstudio.
export default function CompetitionTab({ access, editMode = false }) {
  const { config } = access
  if (!config) return null
  const block = (id, label, el, options) => <PageBlock id={id} label={label} editMode={editMode} options={options}>{el}</PageBlock>
  // Uitslagen en programma: hoeveel rondes in beeld (item 1244)
  const roundOptions = [{ key: 'window', label: 'Rondes', fallback: 2,
    choices: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 'all', label: 'Alles' }] }]
  return (
    <div>
      {editMode && <FeatureFlagBar access={access} page="competition" />}
      <PageTitle view="competition" suffix={config.poule_name ? ` · ${config.poule_name}` : ''} />
      {block('competition.standings', 'Pouletabel', <CompetitionStandings />)}
      {block('competition.chances', 'Kans op elke eindplek', <PositionChances pouleId={config.poule_id} teamId={config.team_id} />)}
      {block('competition.results', 'Uitslagen en programma', <PouleResults pouleId={config.poule_id} teamName={config.team_name} />, roundOptions)}
      {block('competition.regrouping', 'Herindelingsprognose', <RegroupingForecast tournamentId={config.tournament_id} teamId={config.team_id} />)}
    </div>
  )
}
