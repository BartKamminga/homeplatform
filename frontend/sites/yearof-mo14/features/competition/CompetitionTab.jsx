import { useState } from 'react'
import NationalQueries from '../../screens/NationalQueries.jsx'
import PositionChances from './PositionChances.jsx'
import PouleResults from './PouleResults.jsx'
import RegroupingForecast from './RegroupingForecast.jsx'

// Tab "Competitie" (items 1229-1232): kans op eindplek, alle uitslagen in de
// poule, herindelingsprognose en Topklasse landelijk. Achter een featureflag:
// zolang niet vrijgegeven ziet alleen de platformbeheerder de tab, met een
// balk om hem vrij te geven (zie useCompetitionAccess).
export default function CompetitionTab({ access }) {
  const { config, isPlatformAdmin, setPublic } = access
  const [busy, setBusy] = useState(false)
  if (!config) return null

  async function toggle() {
    setBusy(true)
    try { await setPublic(!config.public) } finally { setBusy(false) }
  }

  return (
    <div>
      {isPlatformAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12,
          borderRadius: 10, fontSize: 12, background: config.public ? '#dcfce7' : '#fde68a', color: '#12203c',
        }}>
          <strong style={{ flex: 1 }}>
            {config.public ? 'Zichtbaar voor alle bezoekers' : 'Alleen zichtbaar voor jou (beheerder) - nog niet vrijgegeven'}
          </strong>
          <button onClick={toggle} disabled={busy} className="yof-btn-secondary" style={{ background: 'white' }}>
            {config.public ? 'Weer verbergen' : 'Vrijgeven voor bezoekers'}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Competitie{config.poule_name ? ` · ${config.poule_name}` : ''}</h2>
      <PositionChances pouleId={config.poule_id} teamId={config.team_id} />
      <PouleResults pouleId={config.poule_id} teamName={config.team_name} />
      <RegroupingForecast tournamentId={config.tournament_id} teamId={config.team_id} />
      {/* Topklasse landelijk (1230): bestaande ranglijst + belangrijke wedstrijden */}
      <NationalQueries />
    </div>
  )
}
