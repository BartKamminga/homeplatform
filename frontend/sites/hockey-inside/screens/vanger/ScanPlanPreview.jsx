import { useState } from 'react'
import { useScanPlanPreview } from './hooks/useScanPlanPreview.jsx'
import { useShadowRun } from './hooks/useShadowRun.jsx'
import { useCandidateQueueFilter } from './hooks/useCandidateQueueFilter.jsx'
import { REASON_META } from './reasonMeta.js'

// item 1084: scope-tabs + scenario-tabs + tijdlijn + queue-filter-pills +
// queue-impact-paneel - 1-op-1 de HTML-mockup die samen met Bart is
// doorontwikkeld (4-09-2026: "dat is een betere versie"), nu gevoed door de
// echte backend-routes (preview-scenario/shadow-run) i.p.v. een JS-
// herberekening.
const SCOPES = [
  { id: 'match', label: 'Wedstrijd', scenarios: [
    { id: 'normal', label: 'Normale wedstrijd',
      desc: 'Wedstrijd nog niet begonnen. Het scanschema plant 2 vaste momenten: 1x checken of de wedstrijd live staat kort na de start, en 1x checken op de eindstand rond het voorspelde einde.' },
    { id: 'never_live', label: 'Nooit live gerapporteerd',
      desc: 'De start-check is al geweest, maar hockey.nl gaf geen status=live terug (dat gebeurt niet voor elke wedstrijd). Er is GEEN automatische herkansing voor de start-check - het enige dat overblijft is de end-check op het voorspelde eindtijdstip.' },
    { id: 'live_confirmed', label: 'Live bevestigd',
      desc: 'De start-check bevestigde status=live. Vanaf dat moment scant het systeem elke "retry/live-cadans"-minuten opnieuw, tot het voorspelde einde + de retry/live-stop-marge.' },
    { id: 'runs_over', label: 'Wedstrijd loopt uit',
      desc: 'De end-check op het voorspelde eindtijdstip leverde nog geen eindstand op (verlenging, shoot-outs, vertraging). Vanaf dan dezelfde retry-cadans als "live bevestigd", tot de retry/live-stop-marge verstrijkt.' },
    { id: 'unknown_start', label: 'Onbekende starttijd',
      desc: 'hockey.nl heeft nog geen kick-off-tijd gepubliceerd (placeholder 00:00). Zolang de wedstrijddatum binnen het "vooruitkijken"-venster valt, wordt er periodiek herchecked, binnen het scan-venster.' },
  ] },
  { id: 'poule', label: 'Poule & Competitie', scenarios: [
    { id: 'no_match_today', label: 'Geen wedstrijd vandaag',
      desc: 'Geen wedstrijd gepland voor deze poule vandaag, maar er komt binnen 7 dagen nog wel een. De dagelijkse fallback houdt de poule toch periodiek ververst binnen het scan-venster, als vangnet voor correcties.' },
    { id: 'healthy', label: "Poule is 'gezond' - geskipt",
      desc: 'Alle wedstrijden hebben een bekende starttijd én de laatst gespeelde wedstrijd heeft al een eindstand. De dagelijkse fallback wordt dan bewust overgeslagen - niets te ontdekken, geen scan nodig.' },
    { id: 'landelijk', label: 'Landelijke competitie',
      desc: 'Bij een landelijke competitie (hl_comp_id) worden ALLE onderliggende poules met 1 gecombineerde get_competition_detail-scan ververst, i.p.v. elke poule apart.' },
  ] },
  { id: 'club', label: 'Club & Alle Clubs', scenarios: [
    { id: 'club_scan', label: 'Individuele club',
      desc: 'Elke club wordt periodiek herscand op nieuwe teams/poules - nooit in het weekend (zaterdag/zondag worden overgeslagen, doorgeschoven naar maandag).' },
    { id: 'club_list', label: 'Alle clubs (clublijst)',
      desc: 'De volledige clublijst van de bond wordt periodiek in zijn geheel opnieuw opgehaald - 1 scan voor alle clubs samen, om nieuw toegetreden clubs te ontdekken.' },
  ] },
  { id: 'season', label: 'Seizoen', scenarios: [
    { id: 'phases', label: 'Seizoensfases',
      desc: 'Het seizoen valt uiteen in fases (afgeleid uit de KNHB-speeldagenkalender): veld-najaar, zaal, veld-voorjaar. Alleen tijdens de zaal-fase tellen ZA-competities mee als "actief" voor het hockey_type-filter.' },
    { id: 'manual_weekly', label: 'Wekelijkse ronde',
      desc: 'Competities zonder scan_profile="active" krijgen geen matchday-burst, maar wel 1x per week een verse scan - op een vaste, aan de competitie gekoppelde weekdag, verspreid over de werkweek.' },
  ] },
]

const DAY_MS = 24 * 3600 * 1000

function fmtAxis(iso, spanMs) {
  const d = new Date(iso)
  if (spanMs > 3 * DAY_MS) return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
function fmtTickTime(iso, spanMs) {
  const d = new Date(iso)
  if (spanMs > 3 * DAY_MS) return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
function fmtMeta(spanMs) {
  const days = spanMs / DAY_MS
  return days > 3 ? `venster: ${Math.round(days)} dagen` : `venster: ${Math.round(spanMs / 3600000)} uur`
}

function computeWindow(rows) {
  const times = []
  for (const row of rows) {
    for (const t of row.ticks || []) times.push(new Date(t.planned_at).getTime())
    for (const t of row.past || []) times.push(new Date(t.planned_at).getTime())
    for (const b of row.bars || []) { times.push(new Date(b.from).getTime()); times.push(new Date(b.to).getTime()) }
  }
  if (!times.length) return null
  let min = Math.min(...times), max = Math.max(...times)
  const pad = Math.max((max - min) * 0.08, 20 * 60000)
  min -= pad
  max += Math.max(pad, 1)
  return { min, max, span: max - min }
}

function tabBtn(active, label, onClick, key, variant) {
  const scopeStyle = variant === 'scope'
    ? { padding: '6px 13px', borderRadius: 7, border: 'none', background: active ? 'var(--color-primary)' : 'transparent', color: active ? '#1a1a10' : 'var(--color-text-muted)', fontWeight: 600 }
    : { padding: '5px 11px', borderRadius: 14, border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, background: active ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent', color: active ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: active ? 600 : 400 }
  return (
    <button key={key} onClick={onClick} style={{
      fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', ...scopeStyle,
    }}>{label}</button>
  )
}

function Axis({ window: win }) {
  const steps = 7
  return (
    <div style={{ position: 'relative', height: 16, borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const t = win.min + (win.span * i) / steps
        return (
          <span key={i} style={{ position: 'absolute', left: (i / steps) * 100 + '%', fontSize: 9, color: 'var(--color-text-muted)', transform: 'translateX(-50%)' }}>
            {fmtAxis(t, win.span)}
          </span>
        )
      })}
    </div>
  )
}

const PHASE_COLOR = { 'Veld najaar': '#2a78d6', Zaal: '#8a5cf6', 'Veld voorjaar': '#2a78d6', 'Indeling verwacht': '#64748b' }

function Bars({ bars, window: win, height = 34 }) {
  const pct = iso => Math.min(100, Math.max(0, ((new Date(iso).getTime() - win.min) / win.span) * 100))
  return (
    <>
      {(bars || []).map((b, i) => (
        <div key={i} title={b.label} style={{
          position: 'absolute', left: pct(b.from) + '%', width: Math.max(pct(b.to) - pct(b.from), 1.2) + '%',
          top: height === 34 ? 8 : 4, height: height === 34 ? 18 : 14, borderRadius: 4,
          background: PHASE_COLOR[b.label] || 'var(--color-primary)', opacity: b.dimmed ? 0.3 : 0.9,
          display: 'flex', alignItems: 'center', justifyContent: height !== 34 ? 'center' : 'flex-start', padding: '0 6px',
          fontSize: 9, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
        }}>{b.label}</div>
      ))}
    </>
  )
}

function WeekendBands({ window: win }) {
  const bands = []
  const start = new Date(win.min)
  start.setHours(0, 0, 0, 0)
  for (let t = start.getTime(); t < win.max; t += DAY_MS) {
    const dow = new Date(t).getDay() // 0=zo, 6=za
    if (dow === 0 || dow === 6) {
      const left = Math.max(0, ((t - win.min) / win.span) * 100)
      const right = Math.min(100, ((t + DAY_MS - win.min) / win.span) * 100)
      if (right > left) bands.push({ left, width: right - left })
    }
  }
  return bands.map((b, i) => (
    <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: b.left + '%', width: b.width + '%', background: 'rgba(255,255,255,0.04)' }} />
  ))
}

function NowLine({ now, window: win }) {
  if (!now) return null
  const t = new Date(now).getTime()
  if (t < win.min || t > win.max) return null
  const left = ((t - win.min) / win.span) * 100
  return (
    <div style={{ position: 'absolute', top: -4, bottom: -4, left: left + '%', width: 2, background: 'var(--color-primary)', opacity: 0.8 }}>
      <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: 'var(--color-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>nu</span>
    </div>
  )
}

function Tick({ t, window: win, detailed }) {
  const left = Math.min(100, Math.max(0, ((new Date(t.planned_at).getTime() - win.min) / win.span) * 100))
  const color = REASON_META[t.reason]?.color || 'var(--color-primary)'
  const label = t.note || REASON_META[t.reason]?.label || t.reason
  return (
    <div style={{ position: 'absolute', left: left + '%', top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
      <div style={{
        width: detailed ? 10 : 9, height: detailed ? 10 : 9, borderRadius: '50%',
        background: t.ghost ? 'transparent' : color,
        border: t.ghost ? '1.5px dotted rgba(150,150,150,0.5)' : t.skipped ? '2px dashed var(--color-text-muted)' : '2px solid var(--color-surface)',
        opacity: t.skipped ? 0.4 : 1,
      }} />
      {detailed && <div style={{ width: 1, height: 8, background: 'var(--color-border)' }} />}
      <div style={{
        fontSize: 8.5, color: 'var(--color-text-muted)', marginTop: 3, whiteSpace: 'nowrap', maxWidth: 84,
        textAlign: 'center', lineHeight: 1.2, opacity: t.ghost ? 0.5 : 1, fontStyle: t.ghost ? 'italic' : 'normal',
      }}>{label}</div>
      {detailed && <div style={{ fontSize: 8, color: 'var(--color-text-muted)', opacity: 0.7 }}>{fmtTickTime(t.planned_at, win.span)}</div>}
    </div>
  )
}

function SingleView({ row, window: win, now, weekend }) {
  return (
    <div>
      <Axis window={win} />
      <div style={{ position: 'relative', height: (row.bars || []).length ? 34 : 10, marginBottom: 2 }}>
        {weekend && <WeekendBands window={win} />}
        <Bars bars={row.bars} window={win} height={34} />
        <NowLine now={now} window={win} />
      </div>
      <div style={{ position: 'relative', height: 52, marginTop: 8 }}>
        {!row.ticks?.length
          ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', padding: '16px 0' }}>Geen scanmomenten gepland in dit venster.</div>
          : row.ticks.map((t, i) => <Tick key={i} t={t} window={win} detailed />)}
      </div>
    </div>
  )
}

function RowsView({ rows, window: win, now }) {
  return (
    <div>
      <Axis window={win} />
      {rows.map(row => (
        <div key={row.key} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>{row.label}</div>
          <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginBottom: 6 }}>{row.sub}</div>
          <div style={{ position: 'relative', height: 22, marginBottom: 2 }}>
            <Bars bars={row.bars} window={win} height={22} />
            <NowLine now={now} window={win} />
          </div>
          <div style={{ position: 'relative', height: 40 }}>
            {(row.ticks || []).map((t, i) => <Tick key={i} t={t} window={win} detailed={false} />)}
          </div>
          {row.note && <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 4 }}>{row.note}</div>}
        </div>
      ))}
    </div>
  )
}

function Legend({ rows }) {
  const reasons = new Set()
  let hasGhostOrSkipped = false
  for (const row of rows) {
    for (const t of row.ticks || []) {
      reasons.add(t.reason)
      if (t.ghost || t.skipped) hasGhostOrSkipped = true
    }
  }
  if (!reasons.size) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border)', fontSize: 10, color: 'var(--color-text-muted)' }}>
      {[...reasons].map(r => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: REASON_META[r]?.color || 'var(--color-primary)', flexShrink: 0 }} />
          {REASON_META[r]?.label || r}
        </div>
      ))}
      {hasGhostOrSkipped && <div style={{ opacity: 0.7 }}>gestippeld/vaag = zou hier staan mét autoscan, of overgeslagen</div>}
    </div>
  )
}

const CANDIDATE_GENDERS_JUN = ['Jongens', 'Meisjes']
const CANDIDATE_GENDERS_SEN = ['Heren', 'Dames']

function FilterPill({ on, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10.5, padding: '4px 10px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
      border: `1px solid ${on ? '#ff3e6c' : 'var(--color-border)'}`,
      background: on ? '#ff3e6c' : 'transparent',
      color: on ? '#fff' : 'var(--color-text-muted)', fontWeight: on ? 600 : 400,
    }}>{label}</button>
  )
}

const IMPACT_COLORS = {
  match_start_check: '#2ab7ca', match_end_check: '#eb6834', retry_match_end: '#f2994a', match_live: '#0ca30c',
  daily_fallback: '#8a5cf6', unknown_start_recheck: '#c026d3', new_or_empty: '#64748b',
  manual_weekly: '#4f46e5', club_scan: '#0891b2', club_list: '#0e7490',
}

function ImpactPanel({ shadow, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px dashed var(--color-border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700 }}>📊 Invloed op de scanqueue</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>echte shadow-run (build_schedule_events, 14 dagen) - reageert op elke instelling en het queue-filter hieronder</div>
      {loading && !shadow && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Berekenen...</div>}
      {shadow && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .15s' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 2 }}>
            {shadow.totals.matches_filter}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 6 }}>
              van de {shadow.totals.planned} geplande scans (14 dagen) binnen het filter
            </span>
          </div>
          <div style={{ display: 'flex', height: 16, borderRadius: 5, overflow: 'hidden', margin: '8px 0', border: '1px solid var(--color-border)' }}>
            {Object.entries(shadow.by_reason).map(([reason, count]) => (
              <div key={reason} title={`${REASON_META[reason]?.label || reason}: ${count}`} style={{
                width: (shadow.totals.planned > 0 ? count / shadow.totals.planned * 100 : 0) + '%',
                background: IMPACT_COLORS[reason] || 'var(--color-primary)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(shadow.by_reason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
              <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: IMPACT_COLORS[reason] || 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--color-text-muted)' }}>{REASON_META[reason]?.label || reason}</span>
                <span style={{ fontWeight: 700 }}>{count} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 10 }}>/ 14 dagen</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
  const currentScenario = currentScope.scenarios.find(s => s.id === currentScenarioId)

  const { rows, now, loading: previewLoading } = useScanPlanPreview(scope, currentScenarioId, settings)
  const { result: shadow, loading: shadowLoading } = useShadowRun(settings, candidateFilter.filter)

  const genderOptions = [
    ...(candidateFilter.filter.categories.includes('Junioren') ? CANDIDATE_GENDERS_JUN : []),
    ...(candidateFilter.filter.categories.includes('Senioren') ? CANDIDATE_GENDERS_SEN : []),
  ]

  const win = computeWindow(rows)
  const useRows = scope === 'match'
  const isPhases = scope === 'season' && currentScenarioId === 'phases'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0', borderTop: '1px solid var(--color-border)', fontSize: 11 }}>
      <div style={{ fontWeight: 700, fontSize: 11 }}>⚙ Scan-plan preview</div>

      <div style={{ display: 'flex', gap: 3, background: 'var(--color-surface-2, var(--color-bg))', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {SCOPES.map(s => tabBtn(s.id === scope, s.label, () => { setScope(s.id); setScenario(s.scenarios[0].id) }, s.id, 'scope'))}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {currentScope.scenarios.map(sc => tabBtn(sc.id === currentScenarioId, sc.label, () => setScenario(sc.id), sc.id, 'scenario'))}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{currentScenario.label}</div>
          {win && <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{fmtMeta(win.span)}</div>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.5 }}>{currentScenario.desc}</div>

        {scope === 'poule' && currentScenarioId === 'landelijk' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {['Poule 1', 'Poule 2', 'Poule 3', 'Poule 4'].map(p => (
              <span key={p} style={{ fontSize: 9.5, padding: '3px 8px', borderRadius: 12, border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>{p} → 1 scan</span>
            ))}
          </div>
        )}

        <div style={{ opacity: previewLoading ? 0.5 : 1, transition: 'opacity .15s' }}>
          {!win
            ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', padding: '16px 0' }}>
                {isPhases ? 'Nog geen kalenderdata voor dit seizoen.' : 'Geen scan-momenten in dit scenario.'}
              </div>
            : useRows
              ? <RowsView rows={rows} window={win} now={now} />
              : <SingleView row={rows[0]} window={win} now={now} weekend={scope === 'club' && currentScenarioId === 'club_scan'} />}
        </div>

        <Legend rows={rows} />
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
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

        <ImpactPanel shadow={shadow} loading={shadowLoading} />
      </div>
    </div>
  )
}
