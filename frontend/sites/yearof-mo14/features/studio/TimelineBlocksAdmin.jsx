import { useState, useEffect } from 'react'
import { getStandings } from '../../api.js'
import PageBlock from '../blocks/PageBlock.jsx'
import { StandingsCard } from '../../screens/PublicTimeline.jsx'
import NationalQueries from '../../screens/NationalQueries.jsx'

// Blokken onder de wedstrijdlijst (Wedstrijden) in de beheerstudio, elk met
// live/concept (item 1239).
export default function TimelineBlocksAdmin() {
  const [standings, setStandings] = useState(null)
  useEffect(() => { getStandings().then(setStandings).catch(() => {}) }, [])
  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Blokken onder de wedstrijdlijst</h3>
      <PageBlock id="timeline.standings" label="Pouletabel" editMode>
        <StandingsCard standings={standings} />
      </PageBlock>
      <NationalQueries blockPrefix="timeline" editMode />
    </div>
  )
}
