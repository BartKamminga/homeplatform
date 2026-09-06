import { useState } from 'react'
import { pill } from '../ui.jsx'
import { useDiscoveryTree } from './DiscoveryTreeContext.jsx'

// Competition entry: expandable → poules → teams (uitgesplitst uit
// DiscoveryCompetities.jsx, item 737). nested=true: toon class_name ipv
// volledige naam (naam staat al in parent). distBadge: optioneel
// district-label (voor 'per competitie' view). De gedeelde boom-props komen
// sinds RFTR-B6 (item 989, fase 6.2) uit DiscoveryTreeContext i.p.v. props.

export default function CompEntry({ comp: c, nested = false, distBadge = null }) {
  const { expanded, toggle, capturedPoulesByComp, teamsByPoule, cmdBtn, addSingleCmd, clubMap, onDeletePoule } = useDiscoveryTree()
  const [dirtyBusy, setDirtyBusy] = useState(false)
  const [dirtyMsg,  setDirtyMsg]  = useState('')

  const cKey    = 'comp_' + c.id
  const cOpen   = expanded.has(cKey)
  const cPoules = capturedPoulesByComp[c.id] || []
  // item 1105 (Bart, 06-09-2026: "alleen de vuile poules toevoegen aan de
  // cmd queue"): "vuil" = dezelfde definitie als elders in de scan-scheduler
  // (_is_healthy in hockey_vanger_scanplan.py) - unknown_start of
  // overdue_result. busy (een wedstrijd loopt nu) telt bewust NIET mee, dat
  // is puur informatief, geen "niet up-to-date"-signaal.
  const dirtyPoules = cPoules.filter(p => p.unknown_start || p.overdue_result)

  async function handleScanDirtyPoules(e) {
    e.stopPropagation()
    setDirtyBusy(true); setDirtyMsg('')
    for (const p of dirtyPoules) {
      const team = teamsByPoule[p.poule_id]?.[0]
      if (!team) continue
      await addSingleCmd('get_poule', { poule_id: p.poule_id, team_id: team.team_id, label: p.name })
    }
    setDirtyBusy(false)
    setDirtyMsg(`✓ ${dirtyPoules.length}`)
    setTimeout(() => setDirtyMsg(''), 3000)
  }
  // Poule/competitie-health (Bart, 30-08-2026): "bezig" (een wedstrijd loopt
  // nu, hoeft niet per se bevestigd live te zijn), "onbekende tijd" en
  // "uitslag laat" - puur afgeleid uit match-data (routers/hockey_capture.py
  // ::_poule_health), geen scan-geschiedenis/cadans. BEWUST 2 losse velden
  // i.p.v. 1 combinatie: bij seizoensstart heeft bijna elke poule een
  // onbekende-tijd-wedstrijd (hockey.nl publiceert die vaak pas 1-2 weken
  // van tevoren), dat zou het echt selectieve "uitslag laat"-signaal
  // overspoelen als ze 1 vlag deelden. Rollup op competitie-niveau zodat je
  // zonder uitklappen al ziet waar iets speelt.
  const busyCount          = cPoules.filter(p => p.busy).length
  const unknownStartCount  = cPoules.filter(p => p.unknown_start).length
  const overdueResultCount = cPoules.filter(p => p.overdue_result).length
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
        {overdueResultCount > 0 && <span style={pill('partial')} title="Aantal poules met een gespeelde wedstrijd zonder uitslag">⚠ {overdueResultCount} uitslag laat</span>}
        {unknownStartCount > 0 && <span style={pill('muted')} title="Aantal poules met een onbekende starttijd binnen een week (normaal bij seizoensstart)">❔ {unknownStartCount} tijd onbekend</span>}
        {c.hl_comp_id && cmdBtn('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name }, '⟳ comp', '#b45309')}
        {/* item 1105: landelijke competities hebben de '⟳ comp'-knop al
            hierboven - die ververst in 1 call toch alle poules (add_vanger_
            cmd redirect), dus geen aparte per-poule-bulkknop nodig. */}
        {!c.hl_comp_id && dirtyPoules.length > 0 && (
          <button
            onClick={handleScanDirtyPoules}
            disabled={dirtyBusy}
            title={`${dirtyPoules.length} poule(s) met onbekende starttijd of late uitslag in 1x scannen`}
            style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 4, fontFamily: 'inherit', flexShrink: 0,
              border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'none',
              cursor: dirtyBusy ? 'default' : 'pointer',
            }}>
            {dirtyBusy ? '…' : dirtyMsg || `🧹 ${dirtyPoules.length} vuil`}
          </button>
        )}
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
                  {p.overdue_result && <span style={pill('partial')} title="Een wedstrijd is gespeeld maar heeft nog geen uitslag">⚠ Uitslag laat</span>}
                  {p.unknown_start && <span style={pill('muted')} title="Onbekende starttijd binnen een week (normaal bij seizoensstart)">❔ Tijd onbekend</span>}
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
