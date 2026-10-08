import { useState, useEffect } from 'react'
import { getStandings } from '../../api.js'
import { StandingsCard } from '../../screens/PublicTimeline.jsx'

// Pouletabel als blok op de Competitie-pagina (item 1240) - zelfde kaart als
// onder de wedstrijdlijst.
export default function CompetitionStandings() {
  const [standings, setStandings] = useState(null)
  useEffect(() => { getStandings().then(setStandings).catch(() => {}) }, [])
  return <StandingsCard standings={standings} />
}
