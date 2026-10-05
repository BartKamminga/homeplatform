import { C } from './constants.js'
import { QueryCard } from './QueryCard.jsx'

// round_scorers/round_matches zijn bewust weggelaten (item 668): die hebben
// afgeronde wedstrijden nodig en tonen dus "Geen data gevonden" zolang er nog
// niet gespeeld is, met kans op verwarrend identiek ogende kaarten omdat de
// stat per kaart vrij instelbaar is. Kunnen terugkomen zodra er wedstrijden
// gespeeld zijn - de templates/endpoints zelf blijven gewoon bestaan.
// club_ranking is bewust weggehaald uit de standaard-slots (item 960) - de
// template/endpoint blijft bestaan zodat al gepinde clubranglijst-kaarten
// (localStorage pb_query_pins) niet stuk gaan.
const QUERY_SLOTS = [
  { template: 'ranking',          stat: 'points' },
  { template: 'upcoming_matches', stat: '' },
]

// item 1182: herindelingsprognose alleen tonen als er op Topklasse gefilterd is.
const FORECAST_SLOT = { template: 'regrouping_forecast', stat: '' }
const FORECAST_TAG = 'Topklasse'

// De 5 canonieke query-kaarten voor een publicatie(+tag), altijd zichtbaar onder
// de competitielijst (item 659). Niet-gepinde kaarten tonen een live preview met
// de standaardconfiguratie; wijzigingen daarop blijven lokaal (queryDrafts) tot
// je 'm pint, waarna verdere wijzigingen in de echte pin belanden.
export function QuerySlotsSection({
  tournamentId, tournamentName, tags, queryPins, queryDrafts,
  onSetQueryPin, onUpdateQueryPin, onRemoveQueryPin, onSetQueryDraft,
}) {
  const tagKey = [...(tags || [])].sort().join(',')
  const slots = (tags || []).includes(FORECAST_TAG) ? [FORECAST_SLOT, ...QUERY_SLOTS] : QUERY_SLOTS
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: C.muted, padding: '4px 2px 8px', borderTop: `1px solid ${C.border}` }}>
        Queries{tags?.length ? ` · ${tags.join(', ')}` : ''}
      </div>
      {slots.map(({ template, stat }) => {
        const key = `${tournamentId}::${tagKey}::${template}::${stat}`
        const pinnedPin = queryPins.get(key)
        const pin = pinnedPin || {
          tournamentId, tournamentName, tags: tags || [], template, stat, scope: 'round', limit: 3,
          ...(queryDrafts[key] || {}),
        }
        return (
          <QueryCard
            key={key}
            pin={pin}
            pinned={!!pinnedPin}
            onTogglePin={() => pinnedPin ? onRemoveQueryPin(key) : onSetQueryPin(key, pin)}
            onUpdate={patch => pinnedPin ? onUpdateQueryPin(key, patch) : onSetQueryDraft(key, patch)}
          />
        )
      })}
    </div>
  )
}
