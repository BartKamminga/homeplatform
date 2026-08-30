import { pill } from '../ui.jsx'
import { useDiscoveryTree } from './DiscoveryTreeContext.jsx'

// Competition entry: expandable → poules → teams (uitgesplitst uit
// DiscoveryCompetities.jsx, item 737). nested=true: toon class_name ipv
// volledige naam (naam staat al in parent). distBadge: optioneel
// district-label (voor 'per competitie' view). De gedeelde boom-props komen
// sinds RFTR-B6 (item 989, fase 6.2) uit DiscoveryTreeContext i.p.v. props.

export default function CompEntry({ comp: c, nested = false, distBadge = null }) {
  const { expanded, toggle, capturedPoulesByComp, teamsByPoule, cmdBtn, clubMap, onDeletePoule } = useDiscoveryTree()

  const cKey    = 'comp_' + c.id
  const cOpen   = expanded.has(cKey)
  const cPoules = capturedPoulesByComp[c.id] || []
  // Poule/competitie-health (Bart, 30-08-2026): "bezig" (een wedstrijd loopt
  // nu, hoeft niet per se bevestigd live te zijn) en "verdient een scan"
  // (onbekende starttijd binnen een week, of een gespeelde-maar-niet-finale
  // wedstrijd) - puur afgeleid uit match-data (routers/hockey_capture.py::
  // _poule_health), geen scan-geschiedenis/cadans. Rollup op competitie-
  // niveau zodat je zonder uitklappen al ziet waar iets speelt.
  const busyCount      = cPoules.filter(p => p.busy).length
  const needsScanCount = cPoules.filter(p => p.needs_scan).length
  return (
    <div key={c.id}>
      <div
        onClick={() => cPoules.length > 0 && toggle(cKey)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', paddingLeft: nested ? 4 : 2, fontSize: 12, cursor: cPoules.length > 0 ? 'pointer' : 'default', userSelect: 'none' }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
          {cPoules.length > 0 ? (cOpen ? '▾' : '▸') : ''}
        </span>
        {!nested && <span style={{ flex: 1 }}>{c.name}</span>}
        {nested  && (
          <span style={{ flex: 1, color: 'var(--color-text-muted)' }}>
            {c.name}
            {c.class_name && <span style={{ opacity: 0.7 }}> · {c.class_name}</span>}
          </span>
        )}
        {!nested && c.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.class_name}</span>}
        {distBadge && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic', opacity: 0.75 }}>📍 {distBadge}</span>}
        {c.hl_comp_id && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>#{c.hl_comp_id}</span>}
        <span style={pill(cPoules.length > 0 ? 'partial' : 'muted')}>{cPoules.length}/{c.poule_count} poules</span>
        {busyCount > 0 && <span style={pill('danger')} title="Aantal poules met een wedstrijd die nu loopt">🔴 {busyCount} bezig</span>}
        {needsScanCount > 0 && <span style={pill('partial')} title="Aantal poules met een onbekende starttijd binnen een week, of een gespeelde wedstrijd zonder uitslag">⚠ {needsScanCount} scan</span>}
        {c.hl_comp_id && cmdBtn('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name }, '⟳ comp', '#b45309')}
      </div>

      {cOpen && (
        <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
          {cPoules.map(p => {
            const pKey   = 'poule_' + p.poule_id
            const pOpen  = expanded.has(pKey)
            const pTeams = teamsByPoule[p.poule_id] || []
            return (
              <div key={p.poule_id}>
                <div
                  onClick={() => pTeams.length > 0 && toggle(pKey)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', fontSize: 11, cursor: pTeams.length > 0 ? 'pointer' : 'default', userSelect: 'none' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
                    {pTeams.length > 0 ? (pOpen ? '▾' : '▸') : '·'}
                  </span>
                  <span style={{ flex: 1, color: 'var(--color-text)' }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>#{p.poule_id}</span>
                  {pTeams.length > 0 && <span style={pill('ok')}>{pTeams.length} teams</span>}
                  {p.busy && <span style={pill('danger')} title="Er loopt nu een wedstrijd in deze poule">🔴 Bezig</span>}
                  {p.needs_scan && <span style={pill('partial')} title="Onbekende starttijd binnen een week, of een gespeelde wedstrijd zonder uitslag">⚠ Scan verdiend</span>}
                  {pTeams[0]?.team_id && cmdBtn('get_poule', { poule_id: p.poule_id, team_id: pTeams[0].team_id, label: p.name }, '+ cmd', 'var(--color-border)')}
                  <button onClick={e => onDeletePoule(e, p)} title="Poule verwijderen"
                    style={{ fontSize: 10, padding: '1px 5px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 3, cursor: 'pointer' }}>🗑</button>
                </div>
                {pOpen && (
                  <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
                    {pTeams.map(t => (
                      <div key={t.team_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 2px', fontSize: 11 }}>
                        <span style={{ width: 80, flexShrink: 0, fontWeight: 500 }}>{t.short_name}</span>
                        <span style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 10 }}>{clubMap[t.club_external_id] || t.club_external_id}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>#{t.team_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
