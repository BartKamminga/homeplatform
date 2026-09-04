import { useState } from 'react'
import { useScanPlanPreview } from './hooks/useScanPlanPreview.jsx'
import { useShadowRun } from './hooks/useShadowRun.jsx'
import { useCandidateQueueFilter } from './hooks/useCandidateQueueFilter.jsx'
import { REASON_META } from './reasonMeta.js'

// item 1084: scope-tabs + scenario-tabs + tijdlijn + queue-filter-pills +
// queue-impact-paneel - 1-op-1 de HTML-mockup die samen met Bart is
// doorontwikkeld (4-09-2026), nu gevoed door de echte backend-routes
// (preview-scenario/shadow-run) i.p.v. een JS-herberekening.
const SCOPES = [
  { id: 'match', label: 'Wedstrijd', scenarios: [
    { id: 'normal', label: 'Normale wedstrijd' },
    { id: 'never_live', label: 'Nooit live gerapporteerd' },
    { id: 'live_confirmed', label: 'Live bevestigd' },
    { id: 'runs_over', label: 'Wedstrijd loopt uit' },
    { id: 'unknown_start', label: 'Onbekende starttijd' },
  ] },
  { id: 'poule', label: 'Poule & Competitie', scenarios: [
    { id: 'no_match_today', label: 'Geen wedstrijd vandaag' },
    { id: 'healthy', label: "Poule is 'gezond'" },
    { id: 'landelijk', label: 'Landelijke competitie' },
  ] },
  { id: 'club', label: 'Club & Alle Clubs', scenarios: [
    { id: 'club_scan', label: 'Individuele club' },
    { id: 'club_list', label: 'Alle clubs (clublijst)' },
  ] },
  { id: 'season', label: 'Seizoen', scenarios: [
    { id: 'phases', label: 'Seizoensfases' },
    { id: 'manual_weekly', label: 'Wekelijkse ronde' },
  ] },
]

function fmtTick(iso) {
  const d = new Date(iso)
  return d.toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function tabBtn(active, label, onClick, key) {
  return (
    <button key={key} onClick={onClick} style={{
      fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: active ? 'var(--color-primary)' : 'var(--color-surface)',
      color: active ? '#fff' : 'var(--color-text)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

function Timeline({ row }) {
  const times = [
    ...(row.ticks || []).map(t => new Date(t.planned_at).getTime()),
    ...(row.past || []).map(t => new Date(t.planned_at).getTime()),
    ...(row.bars || []).flatMap(b => [new Date(b.from).getTime(), new Date(b.to).getTime()]),
  ]
  if (!times.length) {
    return <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 0' }}>Geen scan-momenten in dit scenario.</div>
  }
  const min = Math.min(...times), max = Math.max(...times)
  const span = Math.max(max - min, 60000)
  const pct = iso => Math.min(100, Math.max(0, ((new Date(iso).getTime() - min) / span) * 100))
  const hasBars = (row.bars || []).length > 0
  const dotTop = hasBars ? 26 : 8

  return (
    <div style={{ position: 'relative', height: hasBars ? 48 : 26, background: 'var(--color-bg)', borderRadius: 6, border: '1px solid var(--color-border)', margin: '4px 0 10px' }}>
      {(row.bars || []).map((b, i) => (
        <div key={'b' + i} title={b.label} style={{
          position: 'absolute', left: pct(b.from) + '%', width: Math.max(pct(b.to) - pct(b.from), 0.5) + '%',
          top: 4, height: 16, borderRadius: 4, background: 'var(--color-primary)', opacity: 0.3,
          fontSize: 9, color: 'var(--color-text)', overflow: 'hidden', whiteSpace: 'nowrap', padding: '1px 4px',
        }}>{b.label}</div>
      ))}
      {(row.past || []).map((t, i) => (
        <div key={'p' + i} title={`${REASON_META[t.reason]?.label || t.reason} - ${t.note || 'geweest'}`} style={{
          position: 'absolute', left: pct(t.planned_at) + '%', top: dotTop, width: 9, height: 9, borderRadius: '50%',
          background: 'var(--color-text-muted)', opacity: 0.4, transform: 'translateX(-50%)',
        }} />
      ))}
      {(row.ticks || []).map((t, i) => (
        <div key={'t' + i} title={`${fmtTick(t.planned_at)} - ${REASON_META[t.reason]?.label || t.reason}${t.note ? ' (' + t.note + ')' : ''}`} style={{
          position: 'absolute', left: pct(t.planned_at) + '%', top: dotTop, width: 11, height: 11, borderRadius: '50%',
          background: REASON_META[t.reason]?.color || 'var(--color-primary)',
          opacity: t.ghost ? 0.3 : (t.skipped ? 0.45 : 1),
          border: t.skipped ? '1px dashed var(--color-text-muted)' : t.ghost ? '1px dashed var(--color-text)' : 'none',
          transform: 'translateX(-50%)',
        }} />
      ))}
    </div>
  )
}

function Row({ row }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>{row.label}</span>
        {row.sub && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{row.sub}</span>}
      </div>
      <Timeline row={row} />
      {row.note && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: -6 }}>{row.note}</div>}
    </div>
  )
}

const CANDIDATE_GENDERS_JUN = ['Jongens', 'Meisjes']
const CANDIDATE_GENDERS_SEN = ['Heren', 'Dames']

function FilterPill({ on, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
      border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: on ? 'var(--color-primary)' : 'var(--color-surface)',
      color: on ? '#fff' : 'var(--color-text)', fontWeight: on ? 600 : 400,
    }}>{label}</button>
  )
}

export default function ScanPlanPreview({ values }) {
  const [scope, setScope] = useState('match')
  const [scenario, setScenario] = useState('normal')
  const candidateFilter = useCandidateQueueFilter()

  // notify_team_ids beinvloedt geen enkele scheduling-regel - niet
  // meesturen naar de preview-routes, scheelt een zinloze override.
  const { notify_team_ids: _notify, ...settings } = values || {}

  const currentScope = SCOPES.find(s => s.id === scope)
  const currentScenarioId = currentScope.scenarios.some(s => s.id === scenario) ? scenario : currentScope.scenarios[0].id

  const { rows, loading: previewLoading } = useScanPlanPreview(scope, currentScenarioId, settings)
  const { result: shadow, loading: shadowLoading } = useShadowRun(settings, candidateFilter.filter)

  const genderOptions = [
    ...(candidateFilter.filter.categories.includes('Junioren') ? CANDIDATE_GENDERS_JUN : []),
    ...(candidateFilter.filter.categories.includes('Senioren') ? CANDIDATE_GENDERS_SEN : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-border)', fontSize: 11 }}>
      <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: '.05em', color: 'var(--color-text-muted)' }}>SCAN-PLAN PREVIEW</div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {SCOPES.map(s => tabBtn(s.id === scope, s.label, () => { setScope(s.id); setScenario(s.scenarios[0].id) }, s.id))}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {currentScope.scenarios.map(sc => tabBtn(sc.id === currentScenarioId, sc.label, () => setScenario(sc.id), sc.id))}
      </div>

      <div style={{ opacity: previewLoading ? 0.5 : 1, transition: 'opacity .15s' }}>
        {rows.map(row => <Row key={row.key} row={row} />)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px dashed var(--color-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)' }}>QUEUE-FILTER (kandidaat, wijzigt de echte filter niet)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 52 }}>Niveau</span>
          {['Junioren', 'Senioren'].map(cat => (
            <FilterPill key={cat} on={candidateFilter.filter.categories.includes(cat)} label={cat} onClick={() => candidateFilter.toggleNiveau(cat)} />
          ))}
        </div>
        {genderOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 52 }}>Geslacht</span>
            {genderOptions.map(g => (
              <FilterPill key={g} on={candidateFilter.filter.genders.includes(g)} label={g} onClick={() => candidateFilter.toggleGender(g)} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 52 }}>Type</span>
          {['VE', 'ZA'].map(ht => (
            <FilterPill key={ht} on={candidateFilter.filter.hockey_types.includes(ht)} label={ht === 'VE' ? '🏑 Veld' : '🏒 Zaal'} onClick={() => candidateFilter.toggleHt(ht)} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: '1px dashed var(--color-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)' }}>INVLOED OP DE SCANQUEUE (echte shadow-run, 14 dagen)</div>
        {shadowLoading && !shadow && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Berekenen...</div>}
        {shadow && (
          <div style={{ opacity: shadowLoading ? 0.5 : 1, transition: 'opacity .15s', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12 }}>
              <strong>{shadow.totals.matches_filter}</strong> van de <strong>{shadow.totals.planned}</strong> geplande scans vallen binnen dit filter
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(shadow.by_reason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                <span key={reason} style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--color-bg)',
                  border: `1px solid ${REASON_META[reason]?.color || 'var(--color-border)'}`,
                }}>
                  {REASON_META[reason]?.label || reason}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
