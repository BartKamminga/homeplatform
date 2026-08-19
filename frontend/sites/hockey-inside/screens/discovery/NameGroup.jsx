import { pill } from '../ui.jsx'
import { classRank } from './discoveryHelpers.js'
import CompEntry from './CompEntry.jsx'

// Groepsheader voor competities met dezelfde naam — kolom-layout (geen extra
// klik). Uitgesplitst uit DiscoveryCompetities.jsx (item 737).

export default function NameGroup({
  nm, nmComps, keyPrefix, showDistBadge = false,
  expanded, toggle, capturedPoulesByComp, teamsByPoule, cmdBtn, clubMap, onDeletePoule,
}) {
  if (nmComps.length === 1) {
    // item 636: in per-competitie view (showDistBadge) niet nested tonen — op zelfde niveau als multi-entry headers
    return (
      <CompEntry
        comp={nmComps[0]} nested={!showDistBadge} distBadge={showDistBadge ? (nmComps[0].district || 'Onbekend') : null}
        expanded={expanded} toggle={toggle} capturedPoulesByComp={capturedPoulesByComp}
        teamsByPoule={teamsByPoule} cmdBtn={cmdBtn} clubMap={clubMap} onDeletePoule={onDeletePoule}
      />
    )
  }
  const ngKey    = `${keyPrefix}_${nm}`
  const ngOpen   = expanded.has(ngKey)
  const ngPoules = nmComps.reduce((s, c) => s + (capturedPoulesByComp[c.id]?.length ?? 0), 0)
  const ngTotal  = nmComps.reduce((s, c) => s + (c.poule_count || 0), 0)
  // item 643: kolommen sorteren op class_name hiërarchie (Topklasse < Subtopklasse < 1e klas < 2e klas …)
  const colItems = showDistBadge
    ? nmComps
    : [...nmComps].sort((a, b) => {
        const r = classRank(a.class_name) - classRank(b.class_name)
        return r !== 0 ? r : (a.class_name || '').localeCompare(b.class_name || '', 'nl')
      })
  return (
    <div key={nm} style={{ marginBottom: 8 }}>
      {/* Naam-header — item 634: inklapbaar */}
      <div onClick={() => toggle(ngKey)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>{ngOpen ? '▾' : '▸'}</span>
        <span style={{ flex: 1 }}>{nm}</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.6 }}>{nmComps.length}×</span>
        <span style={pill(ngPoules > 0 ? 'partial' : 'muted')}>{ngPoules}/{ngTotal} poules</span>
      </div>
      {/* Kolommen: één per district/klasse */}
      {ngOpen && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 10, marginTop: 3 }}>
        {colItems.map(c => {
          const cPoules = capturedPoulesByComp[c.id] || []
          // per-competitie: kolom-label = district; per-district: kolom-label = class_name
          const colLabel = showDistBadge
            ? (c.district || 'Onbekend')
            : (c.class_name || c.district || 'Onbekend')
          const colSub   = showDistBadge ? c.class_name : null
          return (
            <div key={c.id} style={{
              flex: '1 1 140px', minWidth: 120, maxWidth: 260,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {/* Kolom-header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {colLabel}
                  </span>
                  {colSub && <span style={{ fontSize: 9, color: 'var(--color-text-muted)', opacity: 0.65 }}>{colSub}</span>}
                </div>
                {c.hl_comp_id && cmdBtn('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name }, '⟳', 'var(--color-border)')}
              </div>
              {/* Poules in deze kolom */}
              {cPoules.length > 0 ? cPoules.map(p => {
                const pKey   = 'poule_' + p.poule_id
                const pOpen  = expanded.has(pKey)
                const pTeams = teamsByPoule[p.poule_id] || []
                return (
                  <div key={p.poule_id}>
                    <div
                      onClick={() => pTeams.length > 0 && toggle(pKey)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: pTeams.length > 0 ? 'pointer' : 'default', padding: '2px 0', userSelect: 'none' }}>
                      <span style={{ fontSize: 9, color: 'var(--color-text-muted)', width: 8, flexShrink: 0 }}>
                        {pTeams.length > 0 ? (pOpen ? '▾' : '▸') : '·'}
                      </span>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      {pTeams.length > 0 && <span style={pill('ok')}>{pTeams.length}</span>}
                      {pTeams[0]?.team_id && cmdBtn('get_poule', { poule_id: p.poule_id, team_id: pTeams[0].team_id, label: p.name }, '+ cmd', 'var(--color-border)')}
                      <button onClick={e => onDeletePoule(e, p)} title="Poule verwijderen"
                        style={{ fontSize: 9, padding: '0 4px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 3, cursor: 'pointer' }}>🗑</button>
                    </div>
                    {pOpen && (
                      <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
                        {pTeams.map(t => (
                          <div key={t.team_id} style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '1px 0' }}>
                            <span style={{ fontWeight: 500 }}>{t.short_name}</span>
                            {clubMap[t.club_external_id] && <span style={{ opacity: 0.6 }}> · {clubMap[t.club_external_id]}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }) : (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.5, fontStyle: 'italic' }}>
                  {c.poule_count ? `${c.poule_count} poules (nog niet gevangen)` : 'Geen poules'}
                </div>
              )}
            </div>
          )
        })}
      </div>}
    </div>
  )
}
