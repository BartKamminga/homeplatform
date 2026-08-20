import { C, SEASON, categoryOf, pillStyle, pinButtonStyle } from './constants.js'
import { SeizoenInfo } from './TournixBrowseCards.jsx'
import { CompBrowseItem } from './BrowseComponents.jsx'
import { QuerySlotsSection } from './QuerySlotsSection.jsx'

// item 749: tags groeperen op categorie in de filterbalk - puur presentatie,
// "Overig" (geen categorie) staat altijd als laatste groep. Verandert niets
// aan tagFilters/onToggleTagFilter, die werken nog steeds op tag-naam.
function groupTagsByCategory(allTags) {
  const groups = new Map()
  for (const tag of allTags) {
    const key = tag.category_name || '__none__'
    if (!groups.has(key)) groups.set(key, { name: tag.category_name, order: tag.category_order, tags: [] })
    groups.get(key).tags.push(tag)
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.name) return 1
    if (!b.name) return -1
    return (a.order ?? 0) - (b.order ?? 0)
  })
}

export function BrowseView({
  all, error, selectedPub,
  infoOpen, onToggleInfo,
  tagFilters, onToggleTagFilter, onClearTagFilters, filtersOpen, onToggleFiltersOpen, allTags,
  pubComps, filteredComps, expandedCompId, onToggleComp,
  club, poolPins, onPoolPin,
  queryPins, queryDrafts, onSetQueryPin, onUpdateQueryPin, onRemoveQueryPin, onSetQueryDraft,
  filterPinned, onToggleFilterPin,
}) {
  const activeCount = tagFilters.size
  const filterSummary = activeCount === 0 ? '' : activeCount === 1 ? ` · ${[...tagFilters][0]}` : ` · ${activeCount} tags`
  return (
    <div style={{ padding: '12px 10px' }}>
      {error && (
        <div style={{ background: '#3a1010', border: '1px solid #7a2020', borderRadius: 10,
          padding: '12px 16px', color: '#f88', fontSize: 13, margin: '8px 0' }}>
          {error}
        </div>
      )}
      {all === null && !error && (
        <div style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 }}>Laden…</div>
      )}
      {all !== null && all.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏒</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
            letterSpacing: '0.06em', marginBottom: 10 }}>NOG GEEN TOERNOOIEN</div>
          <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
            Maak toernooien aan in Tournix<br />
            met seizoen <span style={{ color: C.gold, fontWeight: 600 }}>{SEASON}</span>
          </div>
        </div>
      )}
      {selectedPub && all !== null && (
        <>
          <SeizoenInfo cat={categoryOf(selectedPub.name)} open={infoOpen} onToggle={onToggleInfo} />
          {allTags.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: filtersOpen ? 6 : 12 }}>
                <button onClick={onToggleFiltersOpen} style={pillStyle(activeCount > 0, 'sm')}>
                  {filtersOpen ? '▲ Filter' : `▼ Filter${filterSummary}`}
                </button>
                {!filtersOpen && activeCount > 0 && (
                  <button onClick={onClearTagFilters} style={pillStyle(false, 'sm')}>✕</button>
                )}
                {onToggleFilterPin && (
                  <button
                    onClick={onToggleFilterPin}
                    title={filterPinned ? 'Verwijder deze filter-selectie van board' : 'Pin deze filter-selectie op board'}
                    style={{ ...pinButtonStyle(filterPinned, 'sm'), fontFamily: 'inherit', marginLeft: 'auto' }}
                  >📌</button>
                )}
              </div>
              {filtersOpen && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <button onClick={onClearTagFilters} style={pillStyle(activeCount === 0)}>Alle</button>
                  </div>
                  {groupTagsByCategory(allTags).map(group => (
                    <div key={group.name || '__none__'} style={{ marginBottom: 6 }}>
                      {group.name && (
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 3 }}>{group.name}</div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {group.tags.map(tag => (
                          <button key={tag.name} onClick={() => onToggleTagFilter(tag.name)}
                            style={pillStyle(tagFilters.has(tag.name))}>{tag.name}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {pubComps === null ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 }}>Laden…</div>
          ) : filteredComps.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: '24px 0', fontStyle: 'italic', fontSize: 13 }}>
              Geen competities{activeCount > 0 ? ` voor ${[...tagFilters].join(', ')}` : ''}
            </div>
          ) : (
            filteredComps.map(comp => (
              <CompBrowseItem
                key={comp.link_id}
                comp={comp}
                club={club}
                expanded={expandedCompId === comp.link_id}
                onToggle={() => onToggleComp(comp.link_id)}
                poolPins={poolPins}
                onPoolPin={(phaseId, poolName, compName) => onPoolPin(phaseId, poolName, selectedPub?.name, compName)}
              />
            ))
          )}
          {pubComps !== null && pubComps.length > 0 && (
            <QuerySlotsSection
              tournamentId={selectedPub.id}
              tournamentName={selectedPub.name}
              tags={[...tagFilters]}
              queryPins={queryPins}
              queryDrafts={queryDrafts}
              onSetQueryPin={onSetQueryPin}
              onUpdateQueryPin={onUpdateQueryPin}
              onRemoveQueryPin={onRemoveQueryPin}
              onSetQueryDraft={onSetQueryDraft}
            />
          )}
        </>
      )}
    </div>
  )
}
