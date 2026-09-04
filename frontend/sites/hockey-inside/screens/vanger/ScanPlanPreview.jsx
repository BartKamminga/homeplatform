import { useState } from 'react'
import { useScanPlanPreview } from './hooks/useScanPlanPreview.jsx'
import { useShadowRun } from './hooks/useShadowRun.jsx'
import { useCandidateQueueFilter } from './hooks/useCandidateQueueFilter.jsx'
import { REASON_META } from './reasonMeta.js'
import { SCAN_PLAN_GROUPS, SCOPE_GROUPS, NOTIFY_KEY } from './scanPlanFields.js'
import './scanPlanPreview.css'

// item 1084: 1-op-1 nagebouwd op de goedgekeurde HTML-mockup (Bart,
// 4-09-2026: "gewoon precies hetzelfde nabouwen") - zelfde class-namen/CSS
// als de mockup (scanPlanPreview.css), zelfde layout (instellingen LINKS,
// tijdlijn-preview RECHTS, queue-invloed ONDER, over de volle breedte),
// gevoed door de echte backend-routes (preview-scenario/shadow-run) i.p.v.
// een JS-herberekening.
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
const PHASE_COLOR = { 'Veld najaar': 'var(--col-veld)', Zaal: 'var(--col-zaal)', 'Veld voorjaar': 'var(--col-veld)', 'Indeling verwacht': 'var(--color-text-muted)' }

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

function Axis({ window: win, cls = 'axis' }) {
  const steps = 8
  return (
    <div className={cls}>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const t = win.min + (win.span * i) / steps
        return <span key={i} style={{ left: (i / steps) * 100 + '%' }}>{fmtAxis(t, win.span)}</span>
      })}
    </div>
  )
}

function pctOf(win, iso) { return Math.min(100, Math.max(0, ((new Date(iso).getTime() - win.min) / win.span) * 100)) }

function WeekendBands({ window: win }) {
  const bands = []
  const start = new Date(win.min)
  start.setHours(0, 0, 0, 0)
  for (let t = start.getTime(); t < win.max; t += DAY_MS) {
    const dow = new Date(t).getDay()
    if (dow === 0 || dow === 6) {
      const left = Math.max(0, ((t - win.min) / win.span) * 100)
      const right = Math.min(100, ((t + DAY_MS - win.min) / win.span) * 100)
      if (right > left) bands.push({ left, width: right - left })
    }
  }
  return bands.map((b, i) => <div key={i} className="weekend-band" style={{ left: b.left + '%', width: b.width + '%' }} />)
}

function NowLine({ now, window: win }) {
  if (!now) return null
  const t = new Date(now).getTime()
  if (t < win.min || t > win.max) return null
  return <div className="now-line" style={{ left: ((t - win.min) / win.span) * 100 + '%' }} />
}

function Tick({ t, window: win }) {
  const cls = 'tick' + (t.dimmed ? ' dimmed' : '') + (t.skipped ? ' skipped' : '') + (t.ghost ? ' ghost' : '')
  return (
    <div className={cls} style={{ left: pctOf(win, t.planned_at) + '%' }}>
      <div className="dot" style={{ background: REASON_META[t.reason]?.color || 'var(--color-primary)' }} />
      <div className="stem" />
      <div className="lbl">{t.note || REASON_META[t.reason]?.label || t.reason}</div>
      <div className="time">{fmtTickTime(t.planned_at, win.span)}</div>
    </div>
  )
}

function SingleView({ row, window: win, now, weekend }) {
  return (
    <>
      <Axis window={win} />
      <div className="track">
        {weekend && <WeekendBands window={win} />}
        {(row.bars || []).map((b, i) => (
          <div key={i} className={b.label === 'Wedstrijd' ? 'match-bar' : 'phase-bar'} style={{
            left: pctOf(win, b.from) + '%', width: Math.max(pctOf(win, b.to) - pctOf(win, b.from), 1.5) + '%',
            background: b.label === 'Wedstrijd' ? 'var(--col-match)' : (PHASE_COLOR[b.label] || 'var(--color-primary)'),
            opacity: b.dimmed ? 0.3 : undefined,
          }}>{b.label}</div>
        ))}
        <NowLine now={now} window={win} />
      </div>
      <div className={'ticks-track' + ((row.ticks || []).length > 6 ? ' multi-row' : '')}>
        {!row.ticks?.length && <div className="empty-note">Geen scanmomenten gepland in dit venster.</div>}
        {(row.ticks || []).map((t, i) => <Tick key={i} t={t} window={win} />)}
      </div>
    </>
  )
}

function RowsView({ rows, window: win, now }) {
  return (
    <>
      <Axis window={win} cls="rows-axis" />
      {rows.map(row => (
        <div key={row.key} className="row-block">
          <div className="row-label">{row.label}</div>
          <div className="row-sub">{row.sub}</div>
          <div className="row-track">
            {(row.bars || []).map((b, i) => (
              <div key={i} className={'row-bar' + (b.dimmed ? ' dimmed' : '')} style={{
                left: pctOf(win, b.from) + '%', width: Math.max(pctOf(win, b.to) - pctOf(win, b.from), 1) + '%', background: 'var(--col-match)',
              }} />
            ))}
            <NowLine now={now} window={win} />
          </div>
          <div className="row-ticks">
            {(row.ticks || []).map((t, i) => (
              <div key={i} className={'row-tick' + (t.ghost ? ' ghost' : '')} style={{ left: pctOf(win, t.planned_at) + '%' }}>
                <div className="dot" style={{ background: REASON_META[t.reason]?.color || 'var(--color-primary)' }} />
                <div className="lbl">{t.note || REASON_META[t.reason]?.label || t.reason}</div>
              </div>
            ))}
          </div>
          {row.note && <div className="row-note">{row.note}</div>}
        </div>
      ))}
    </>
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
    <div className="legend">
      {[...reasons].map(r => (
        <div key={r} className="item"><span className="sw" style={{ background: REASON_META[r]?.color || 'var(--color-primary)' }} />{REASON_META[r]?.label || r}</div>
      ))}
      {hasGhostOrSkipped && <div className="item" style={{ opacity: 0.7 }}>gestippeld/vaag = zou hier staan mét autoscan, of overgeslagen</div>}
    </div>
  )
}

const CANDIDATE_GENDERS_JUN = ['Jongens', 'Meisjes']
const CANDIDATE_GENDERS_SEN = ['Heren', 'Dames']

const IMPACT_COLORS = {
  match_start_check: 'var(--col-start-check)', match_end_check: 'var(--col-end-check)', retry_match_end: 'var(--col-retry)', match_live: 'var(--col-live)',
  daily_fallback: 'var(--col-fallback)', unknown_start_recheck: 'var(--col-unknown)', new_or_empty: 'var(--color-text-muted)',
  manual_weekly: 'var(--col-clublist)', club_scan: 'var(--col-clubscan)', club_list: 'var(--col-clublist)',
}

export default function ScanPlanPreview({ values, set, save, matchdayEnabled, onToggleMatchday }) {
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
  const relevantGroups = SCOPE_GROUPS[scope] || []
  const values_ = values || {}

  return (
    <div className="spp">
      <div className="spp-title">⚙ Scan-plan preview</div>
      <div className="spp-sub">Instellingen wijzigen werkt meteen door in de tijdlijn en de queue-invloed - pas "Opslaan" zet ze ook echt vast.</div>

      <div className="scope-tabs">
        {SCOPES.map(s => (
          <button key={s.id} className={'scope-tab' + (s.id === scope ? ' active' : '')} onClick={() => { setScope(s.id); setScenario(s.scenarios[0].id) }}>{s.label}</button>
        ))}
      </div>
      <div className="tabs">
        {currentScope.scenarios.map(sc => (
          <button key={sc.id} className={'tab' + (sc.id === currentScenarioId ? ' active' : '')} onClick={() => setScenario(sc.id)}>{sc.label}</button>
        ))}
      </div>

      <div className="spp-layout">
        <div className="spp-card">
          {SCAN_PLAN_GROUPS.map(group => (
            <div key={group.title} className={'group' + (relevantGroups.length && !relevantGroups.includes(group.title) ? ' inactive' : '')}>
              <div className="group-title">{group.title}</div>
              {group.fields.map(f => (
                <div key={f.key} className="field-row">
                  <label title={f.help}>{f.label}</label>
                  <input type="number" min="1" value={values_[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          ))}

          <div className="group">
            <div className="group-title">Overig</div>
            <div className="field-row">
              <label title="Alleen de event-driven matchday-boost voor publicatie-competities met scan_profile 'actief' aan/uit.">Matchday-interval actief</label>
              <input type="checkbox" checked={matchdayEnabled} onChange={onToggleMatchday} />
            </div>
            <div className="field-row">
              <label title="Comma-gescheiden hockey.nl team_ids - pushmelding bij eindstand (item 1001)">Meldingen team-id(s)</label>
              <input type="text" style={{ width: 100, textAlign: 'left' }} placeholder="123456,789012" value={values_[NOTIFY_KEY] ?? ''} onChange={e => set(NOTIFY_KEY, e.target.value)} />
            </div>
          </div>

          <div className="group" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
            <div className="group-title">📱 Queue-filter</div>
            <div className="pill-row">
              <span className="pill-lbl">Niveau</span>
              <div className="pill-group">
                {['Junioren', 'Senioren'].map(cat => (
                  <button key={cat} className={'pill' + (candidateFilter.filter.categories.includes(cat) ? ' selected' : '')} onClick={() => candidateFilter.toggleNiveau(cat)}>{cat}</button>
                ))}
              </div>
            </div>
            {genderOptions.length > 0 && (
              <div className="pill-row">
                <span className="pill-lbl">Geslacht</span>
                <div className="pill-group">
                  {genderOptions.map(g => (
                    <button key={g} className={'pill' + (candidateFilter.filter.genders.includes(g) ? ' selected' : '')} onClick={() => candidateFilter.toggleGender(g)}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="pill-row">
              <span className="pill-lbl">Type</span>
              <div className="pill-group">
                {['VE', 'ZA'].map(ht => (
                  <button key={ht} className={'pill' + (candidateFilter.filter.hockey_types.includes(ht) ? ' selected' : '')} onClick={() => candidateFilter.toggleHt(ht)}>{ht === 'VE' ? '🏑 Veldhockey' : '🏒 Zaalhockey'}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={save}
              style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
            >Opslaan</button>
          </div>
        </div>

        <div className="spp-card">
          <div className="timeline-header">
            <div className="title">{currentScenario.label}</div>
            {win && <div className="meta">{fmtMeta(win.span)}</div>}
          </div>
          <div className="scenario-desc">{currentScenario.desc}</div>

          {scope === 'poule' && currentScenarioId === 'landelijk' && (
            <div className="chip-row">
              {['Poule 1', 'Poule 2', 'Poule 3', 'Poule 4'].map(p => <span key={p} className="chip merged">{p} → 1 scan</span>)}
            </div>
          )}

          <div style={{ opacity: previewLoading ? 0.5 : 1, transition: 'opacity .15s' }}>
            {!win
              ? <div className="empty-note">{scope === 'season' && currentScenarioId === 'phases' ? 'Nog geen kalenderdata voor dit seizoen.' : 'Geen scan-momenten in dit scenario.'}</div>
              : useRows
                ? <RowsView rows={rows} window={win} now={now} />
                : <SingleView row={rows[0]} window={win} now={now} weekend={scope === 'club' && currentScenarioId === 'club_scan'} />}
          </div>

          <Legend rows={rows} />
        </div>
      </div>

      <div className="spp-card">
        <div className="timeline-header" style={{ marginBottom: 4 }}>
          <div className="title">📊 Invloed op de scanqueue</div>
          <div className="meta">echte shadow-run (14 dagen) - reageert op elke instelling en het queue-filter hierboven</div>
        </div>
        {shadowLoading && !shadow && <div className="empty-note">Berekenen...</div>}
        {shadow && (
          <div className="impact-layout" style={{ opacity: shadowLoading ? 0.5 : 1, transition: 'opacity .15s' }}>
            <div>
              <div className="impact-total">
                {shadow.totals.matches_filter}
                <span className="unit">van de {shadow.totals.planned} geplande scans (14 dagen) binnen het filter</span>
              </div>
              <div className="impact-bar">
                {Object.entries(shadow.by_reason).map(([reason, count]) => (
                  <div key={reason} className="seg" title={`${REASON_META[reason]?.label || reason}: ${count}`} style={{
                    width: (shadow.totals.planned > 0 ? count / shadow.totals.planned * 100 : 0) + '%',
                    background: IMPACT_COLORS[reason] || 'var(--color-primary)',
                  }} />
                ))}
              </div>
              <div className="impact-breakdown">
                {Object.entries(shadow.by_reason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                  <div key={reason} className="impact-row">
                    <span className="sw" style={{ background: IMPACT_COLORS[reason] || 'var(--color-primary)' }} />
                    <span className="lbl">{REASON_META[reason]?.label || reason}</span>
                    <span className="val">{count} <span className="small">/ 14 dagen</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
