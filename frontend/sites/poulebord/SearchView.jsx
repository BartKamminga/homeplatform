import { C } from './constants.js'
import { TournamentCard } from './TournixBrowseCards.jsx'
import { PoolSearchCard } from './BrowseComponents.jsx'

export function SearchView({ searchQ, visible, searchResults, club, pins, poolPins, onTogglePin, onTogglePoolPin, onOpenResult }) {
  return (
    <div style={{ padding: '10px 10px' }}>
      {searchQ.length < 2 ? (
        <div style={{ textAlign: 'center', color: C.muted, padding: '32px 0', fontSize: 13 }}>
          Typ minimaal 2 tekens om te zoeken…
        </div>
      ) : (
        <>
          {visible.length === 0 && (searchResults === null || searchResults.length === 0) && (
            <div style={{ textAlign: 'center', color: C.muted, padding: '32px 0', fontSize: 13 }}>
              Niets gevonden voor <strong style={{ color: C.chalk }}>{searchQ}</strong>
            </div>
          )}
          {visible.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: '0.05em' }}>
                Competities ({visible.length})
              </div>
              {visible.map(t => (
                <TournamentCard
                  key={t.id} tournament={t} club={club}
                  pinned={pins.has(t.id)} onPin={() => onTogglePin(t.id)}
                  poolPins={poolPins}
                  onPoolPin={(phaseId, poolName) => onTogglePoolPin(phaseId, poolName, t.name)}
                />
              ))}
            </>
          )}
          {searchResults !== null && searchResults.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.muted,
                margin: visible.length > 0 ? '14px 0 8px' : '0 0 8px',
                letterSpacing: '0.05em' }}>
                Teams &amp; poules ({searchResults.length})
              </div>
              {searchResults.map(r => (
                <PoolSearchCard
                  key={`${r.phase_id}::${r.pool_name}`}
                  result={r}
                  poolPins={poolPins}
                  onPoolPin={(phaseId, poolName, tn) => onTogglePoolPin(phaseId, poolName, tn)}
                  onOpen={onOpenResult}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
