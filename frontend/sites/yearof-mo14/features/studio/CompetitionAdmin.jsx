import useCompetitionAccess from '../competition/useCompetitionAccess.js'
import CompetitionTab from '../competition/CompetitionTab.jsx'
import TopklasseTab from '../competition/TopklasseTab.jsx'

// Competitie/Topklasse in de beheerstudio (item 1239): dezelfde pagina als
// op de site, met de schakelaar voor de hele pagina (gele/groene balk) en per
// blok live/concept.
export default function CompetitionAdmin({ page }) {
  const access = useCompetitionAccess()
  return page === 'topklasse'
    ? <TopklasseTab access={access} editMode />
    : <CompetitionTab access={access} editMode />
}
