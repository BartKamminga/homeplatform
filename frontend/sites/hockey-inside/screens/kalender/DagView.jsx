import { useState } from 'react'
import { toDateStr } from './KalenderTab.jsx'
import { eventsOnDate, phaseColor, phaseForDate } from './seasonPhases.js'

// Gevalideerde categorale kleuren (dataviz-skill, validate_palette.js) -
// blauw=wedstrijd. Los van het thema omdat dit een vaste, betekenisvolle
// kleuren-encodering is, geen merk-kleur.
const COL_MATCH     = '#2a78d6'
const COL_GOOD      = '#0ca30c'
const COL_SCHEDULED = '#eda100' // cmd aangemaakt/ingepland - los van of hij al is uitgevoerd (dat is de zwarte stip)

// Bart, 30-08-2026: "wat is het Burst-scanvenster nou eigenlijk nog? ... ik
// heb liever dat op de day view de echte scan momenten zien, en welke dat
// zijn" - de oranje burst-balk was een CLIENTSIDE herberekening (uit
// settings + wedstrijdtijden) van waar het OUDE scan-plan actief zou zijn.
// Sinds de single-tick-fix van het scanschema (_matchday_events toont maar
// 1 eerstvolgende tick i.p.v. de hele serie) klopt die herberekende balk
// niet meer met de werkelijkheid. Vervangen door de ECHTE geplande
// scanschema-momenten (data.schedule_entries), per reason gelabeld.
const REASON_META = {
  match_start_check:     { label: 'Match-start-check',      color: '#2ab7ca' },
  match_end_check:       { label: 'Match-end-check',        color: '#eb6834' },
  retry_match_end:       { label: 'Retry match-end',        color: '#f2994a' },
  match_live:            { label: 'Match-live',             color: '#0ca30c' },
  daily_fallback:        { label: 'Dagelijkse fallback',    color: '#8a5cf6' },
  unknown_start_recheck: { label: 'Onbekende starttijd',    color: '#c026d3' },
  new_or_empty:          { label: 'Nieuwe/lege poule',      color: '#64748b' },
}

const DAY_START_H = 8
const DAY_END_H   = 22

function fmtTime(d) {
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
function timeToPct(date) {
  const h = date.getHours() + date.getMinutes() / 60
  return Math.max(0, Math.min(100, ((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100))
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "N scans gepland vandaag" moet uit het echte scanschema komen (target_type/
// target_id/planned_at) i.p.v. clientside herberekend uit de burst-ticks
// (die alleen match_end_check kennen) - anders klopt de teller niet meer
// zodra er ook match_start_check-momenten gepland staan (Bart,
// 30-08-2026: "3 scans gepland" terwijl de Debug-tab er 4 liet zien).
function scheduleCountFor(scheduleEntries, targetType, targetId, date) {
  return (scheduleEntries || []).filter(e =>
    e.status === 'planned' && e.target_type === targetType && e.target_id === targetId && sameDay(new Date(e.planned_at), date)
  ).length
}

export default function DagView({ data, date, onDateChange, onNavigateToDebug }) {
  const [tooltip, setTooltip] = useState(null)
  const { settings, recent_captures: recentCaptures } = data

  // De Dag-view draait om scan-ACTIVITEIT (burst/live-check), niet om een
  // volledig wedstrijdoverzicht (dat is Week/Maand-view, die bewust ook
  // manual-profile-wedstrijden meetelt). Manual-profile poules hebben geen
  // dag-specifieke scan-activiteit - die zitten al in de "NIET-AUTOSCAN ·
  // WEKELIJKS"-sectie onderaan. Zonder deze filter renderde deze view op
  // een drukke zaterdag 700+ losse rijen die allemaal "niet-autoscan"
  // bleken te zijn - onleesbaar en niet waar deze view voor bedoeld is.
  // Gevolgde teams blijven wel altijd zichtbaar, ongeacht scan_profile.
  const poules = data.poules.filter(p => p.is_landelijke || p.scan_profile === 'active' || p.followed)

  // item: landelijke competities worden met 1 get_competition_detail-command
  // in hun geheel ververst (item 1013) - dus 1 rij per competitie i.p.v. 1
  // rij per poule, met alle memberPouleIds voor de capture-koppeling.
  const landelijkeGroups = new Map()
  const regularPoules = []
  for (const poule of poules) {
    if (!poule.is_landelijke) { regularPoules.push(poule); continue }
    const key = poule.hl_comp_id ?? poule.competition_name
    if (!landelijkeGroups.has(key)) {
      landelijkeGroups.set(key, {
        poule_id: `hl-${key}`, poule_name: poule.competition_name, competition_name: poule.competition_name,
        hl_comp_id: poule.hl_comp_id, is_landelijke: true, followed: false, in_active_filter: false,
        matches: [], memberPouleIds: [], last_scanned_at: undefined,
      })
    }
    const group = landelijkeGroups.get(key)
    group.matches.push(...poule.matches)
    group.memberPouleIds.push(poule.poule_id)
    group.followed = group.followed || poule.followed
    group.in_active_filter = group.in_active_filter || poule.in_active_filter
    // Zelfde semantiek als backend (_step_landelijke_competitions): de
    // competitie is pas "gescand" als ELKE poule een last_scanned_at heeft -
    // 1 nooit-gescande poule maakt de hele groep "nooit gescand" (oudste/
    // ontbrekende wint), consistent met wanneer de echte scan due wordt.
    if (poule.last_scanned_at == null) {
      group.last_scanned_at = null
    } else if (group.last_scanned_at !== null) {
      group.last_scanned_at = (group.last_scanned_at === undefined || poule.last_scanned_at < group.last_scanned_at)
        ? poule.last_scanned_at : group.last_scanned_at
    }
  }
  const groupedPoules = [...regularPoules, ...landelijkeGroups.values()]

  const rows = groupedPoules
    .map(poule => {
      const matches = poule.matches
        .map(m => ({ ...m, dateObj: new Date(m.date) }))
        .filter(m => sameDay(m.dateObj, date))
        .sort((a, b) => a.dateObj - b.dateObj)
      if (!matches.length) return null
      // Alleen scan_profile='active'-poules krijgen matchday-burst/live-check
      // van het echte scan-plan (_step_active_profiles) - manual-profile en
      // followed_only-poules (competitie zelf niet op autoscan) krijgen
      // hoogstens de wekelijkse niet-autoscan-ronde. Zonder deze check liet
      // DagView "N scans gepland" zien voor ELKE poule, ook de ~200
      // manual-profile competities die in werkelijkheid maar 1x per week
      // gescand worden - misleidend.
      const isAutoscan = poule.is_landelijke || poule.scan_profile === 'active'
      const memberIds = poule.memberPouleIds || [poule.poule_id]
      const targetType = poule.is_landelijke ? 'competition' : 'poule'
      const targetId = poule.is_landelijke ? poule.hl_comp_id : poule.poule_id
      const targetEntries = (data.schedule_entries || [])
        .filter(e => e.target_type === targetType && e.target_id === targetId)
      // De echte, door het backend berekende scanschema-momenten voor
      // vandaag - dit VERVANGT de oude clientside burst-balk/ticks-
      // herberekening (zie REASON_META hierboven).
      const scanMoments = targetEntries
        .filter(e => e.status === 'planned' && sameDay(new Date(e.planned_at), date))
        .map(e => ({ ...e, dateObj: new Date(e.planned_at) }))
      // "burst gestopt · volgende scan ..." nu ook rechtstreeks uit het
      // echte schema i.p.v. clientside herberekend uit settings - de
      // eerstvolgende geplande daily_fallback ná vandaag, maar alleen tonen
      // als er voor vandaag zelf geen scans meer open staan (anders lijkt
      // het alsof de burst al gestopt is terwijl er nog een tick vanavond
      // gepland staat).
      const now = new Date()
      const remainingToday = scanMoments.some(e => e.reason !== 'daily_fallback' && e.dateObj > now)
      const nextFallback = targetEntries
        .filter(e => e.status === 'planned' && e.reason === 'daily_fallback' && new Date(e.planned_at) > now && !sameDay(new Date(e.planned_at), date))
        .sort((a, b) => new Date(a.planned_at) - new Date(b.planned_at))[0]
      const nextFallbackScan = (isAutoscan && !remainingToday && nextFallback) ? new Date(nextFallback.planned_at) : null
      const captures = (recentCaptures || [])
        .filter(c => memberIds.includes(c.poule_id))
        .map(c => new Date(c.captured_at))
        .filter(d => sameDay(d, date))
      const scheduled = (data.scheduled_cmds || [])
        .filter(c => memberIds.includes(c.poule_id))
        .map(c => ({ dateObj: new Date(c.event_at || c.scheduled_at), status: c.status, executed: c.executed }))
        .filter(c => sameDay(c.dateObj, date))
      const scanCount = !isAutoscan ? 0 : scheduleCountFor(
        data.schedule_entries, poule.is_landelijke ? 'competition' : 'poule',
        poule.is_landelijke ? poule.hl_comp_id : poule.poule_id, date,
      )
      return { poule, matches, scanMoments, captures, scheduled, scanCount, nextFallbackScan, isAutoscan }
    })
    .filter(Boolean)
    .sort((a, b) => a.matches[0].dateObj - b.matches[0].dateObj)

  // Niet-landelijke poules van dezelfde competitie visueel groeperen onder
  // 1 kop (bv. "Jongens O18 Voorcompetitie" met Poule F/J/A/B eronder) -
  // in tegenstelling tot de landelijke groep hierboven worden deze poules
  // ECHT los gescand (elk hun eigen get_poule-cmd); dit is dus puur
  // leesbaarheid, geen samengevoegde-scan-rij zoals bij landelijk.
  // Groeperen op competition_id, NIET op competition_name: dezelfde
  // generieke naam ("Jongens O18 Voorcompetitie") wordt door meerdere
  // losse competities (verschillende klasses/seizoenen) gebruikt - op naam
  // groeperen gooide die dan onterecht op 1 hoop (bv. "Poule A" van 1e
  // klasse en "Poule A" van 2e klasse leken dan dezelfde rij).
  const landelijkeRows = rows.filter(r => r.poule.is_landelijke)
  const byCompetition = new Map()
  for (const row of rows) {
    if (row.poule.is_landelijke) continue
    const key = row.poule.competition_id ?? row.poule.competition_name ?? '(onbekende competitie)'
    if (!byCompetition.has(key)) byCompetition.set(key, [])
    byCompetition.get(key).push(row)
  }
  const renderItems = landelijkeRows.map(row => ({ type: 'row', row, grouped: false }))
  for (const groupRows of byCompetition.values()) {
    groupRows.sort((a, b) => (a.poule.poule_name || '').localeCompare(b.poule.poule_name || ''))
    if (groupRows.length > 1) {
      const label = groupRows[0].poule.competition_name || '(onbekende competitie)'
      renderItems.push({ type: 'header', label, count: groupRows.length })
    }
    for (const row of groupRows) renderItems.push({ type: 'row', row, grouped: groupRows.length > 1 })
  }

  // Niet-autoscan (scan_profile='manual') publicaties worden 1x per week
  // gescand, verdeeld over maandag/vrijdag (_manual_weekly_events) - JS
  // getDay() (zo=0..za=6) omzetten naar dezelfde ma=0..zo=6-telling als de
  // backend (comp.id % 5 bepaalt de werkdag).
  //
  // item 1009 (Bart, 31-08-2026: "ik wil zien wat er die dag ECHT gescanned
  // gaat worden") - dit bouwde eerder op data.manual_poules, een RUWE,
  // ongefilterde telling (elke manual-profiel-poule met assigned_weekday===
  // vandaag, ongeacht gezondheid/team-koppeling) die geregeld een heel ander
  // aantal/weekdag liet zien dan de echte queue - verwarrend, want 2
  // competities met dezelfde naam (bv. verschillende districts-competities
  // "Jongens O14 Voorcompetitie") hebben elk hun EIGEN competition_id en dus
  // een eigen toegewezen werkdag. data.schedule_entries (reason=
  // manual_weekly) is al de ECHTE, door het scanschema berekende planning
  // (gezondheid/team-koppeling al verwerkt) - zelfde status==='planned'-
  // check als WeekView.jsx::reasonCountsFor, voor consistente tellingen
  // tussen de tabs (Bart, 1-09-2026: een eerdere in_filter-uitsplitsing liet
  // de Dagview 0 tonen terwijl de Weekview voor dezelfde dag wel de echte
  // aantallen liet zien - verwarrend EN kostte een dure per-entry
  // filter-query op de backend).
  const pyWeekday = (date.getDay() + 6) % 7
  const manualEntriesAll = (data.schedule_entries || []).filter(e => e.reason === 'manual_weekly')
  const hasAnyManualScanning = manualEntriesAll.length > 0
  const manualEntriesToday = manualEntriesAll.filter(e => sameDay(new Date(e.planned_at), date))
  const manualPlannedToday = manualEntriesToday.filter(e => e.status === 'planned')
  // Kan in de praktijk honderden poules per dag zijn (alle niet-autoscan
  // publicaties samen) - per competitie samenvatten i.p.v. 1 badge per poule,
  // anders wordt de sectie onleesbaar.
  const manualByCompetition = new Map()
  for (const e of manualPlannedToday) {
    const key = e.competition_name || '(onbekende competitie)'
    manualByCompetition.set(key, (manualByCompetition.get(key) || 0) + 1)
  }
  const manualCompetitionEntries = [...manualByCompetition.entries()].sort((a, b) => b[1] - a[1])
  const MANUAL_COMP_SHOWN = 20
  const WEEKDAY_LABELS = ['MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG']
  // Alleen in het weekend gebeurt er bewust niets - de ronde is verdeeld
  // over de 5 werkdagen. Toch altijd de sectie tonen (i.p.v. 'm gewoon weg
  // te laten) zodat duidelijk is dat dit een ontwerpkeuze is, geen bug - met
  // de eerstvolgende ronde-datum erbij.
  let daysUntilNextManualRound = 1
  while ((pyWeekday + daysUntilNextManualRound) % 7 > 4) daysUntilNextManualRound++
  const nextManualRoundDate = new Date(date)
  nextManualRoundDate.setDate(nextManualRoundDate.getDate() + daysUntilNextManualRound)

  const clubCapturesToday = (data.club_captures || [])
    .map(c => ({ ...c, dateObj: new Date(c.captured_at) }))
    .filter(c => sameDay(c.dateObj, date))
    .sort((a, b) => a.dateObj - b.dateObj)

  function shiftDay(delta) {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    onDateChange(next)
  }

  const phases = data.season_phases || []
  const phase = phaseForDate(phases, date)
  const seasonEventsToday = eventsOnDate(data.season_calendar_events, toDateStr(date))

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <style>{`@keyframes hiLiveBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => shiftDay(-1)} style={navBtnStyle}>←</button>
        <strong style={{ fontSize: 13 }}>{date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <button onClick={() => shiftDay(1)} style={navBtnStyle}>→</button>
        {phase && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: phaseColor(phases, phase) }} />
            {phase.label}
          </span>
        )}
        <button onClick={() => onDateChange(new Date())} style={{ ...navBtnStyle, marginLeft: 'auto' }}>Vandaag</button>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '8px 14px', fontSize: 11, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 7, background: COL_MATCH, borderRadius: 2, marginRight: 4 }} />Wedstrijd</span>
        {Object.entries(REASON_META).map(([key, { label, color }]) => (
          <span key={key}><span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: 2, marginRight: 4, transform: 'rotate(45deg)' }} />{label}</span>
        ))}
        <span style={{ color: COL_GOOD }}>★ Gevolgd team</span>
        <span>⏺ Echte capture</span>
        <span style={{ color: COL_SCHEDULED }}>▲ Cmd echt uitgevoerd</span>
        <span style={{ color: COL_SCHEDULED, opacity: 0.4 }}>▲ Cmd (nog) niet uitgevoerd</span>
        <span style={{ opacity: 0.5 }}>Grijs = buiten actieve queue-filter</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ padding: '4px 10px', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>POULE</div>
        <div style={{ position: 'relative', height: 20 }}>
          {Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i).map(h => (
            <span key={h} style={{ position: 'absolute', left: `${((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100}%`, fontSize: 9, color: 'var(--color-text-muted)' }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>

      {!rows.length && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
          Geen wedstrijden op deze dag (binnen actieve/gevolgde poules).
        </div>
      )}

      {renderItems.map((item, idx) => item.type === 'header' ? (
        <div key={`hdr-${idx}`} style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
          {item.label} · {item.count} poules
        </div>
      ) : (() => {
        const { poule, matches, scanMoments, captures, scheduled, scanCount, nextFallbackScan, isAutoscan } = item.row
        return (
        <div
          key={poule.poule_id}
          style={{
            display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid var(--color-border)',
            opacity: poule.in_active_filter ? 1 : 0.45,
          }}
          title={poule.in_active_filter ? undefined : 'Buiten de actieve queue-filter - wordt niet opgepakt door Ghost/Scout'}
        >
          <div style={{ padding: '6px 10px', paddingLeft: item.grouped ? 20 : 10, fontSize: 11, overflow: 'hidden' }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {poule.followed && <span style={{ color: COL_GOOD, marginRight: 3 }}>★</span>}
              {poule.is_landelijke
                ? `${poule.competition_name} · ${matches.length} wedstrijd${matches.length === 1 ? '' : 'en'}`
                : `${poule.poule_name} · ${matches.length} wedstrijd${matches.length === 1 ? '' : 'en'}`}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
              {poule.is_landelijke
                ? `${poule.memberPouleIds.length} poules samen`
                : (item.grouped ? '' : poule.competition_name)}
            </div>
            {onNavigateToDebug && (
              <span
                onClick={() => onNavigateToDebug({
                  target_type: poule.is_landelijke ? 'competition' : 'poule',
                  target_id: poule.is_landelijke ? poule.hl_comp_id : poule.poule_id,
                  date: toDateStr(date),
                })}
                title="Bekijk het scanschema voor deze poule/dag in de Debug-tab"
                style={{ fontSize: 9, color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                🔍 debug
              </span>
            )}
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>
              {isAutoscan
                ? `${scanCount} scan${scanCount === 1 ? '' : 's'} gepland vandaag`
                : 'niet-autoscan · wekelijkse ronde (zie onderaan)'}
            </div>
            {nextFallbackScan && (
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>
                geen scans meer vandaag · volgende scan (dagelijkse fallback) {fmtTime(nextFallbackScan)} {nextFallbackScan.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', height: 30 }}>
            {Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i).map(h => (
              <div key={h} style={{ position: 'absolute', left: `${((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--color-border)' }} />
            ))}

            {matches.map(m => {
              const end = new Date(m.dateObj.getTime() + settings.match_duration_min * 60000)
              const x1 = timeToPct(m.dateObj)
              const x2 = timeToPct(end)
              const isLive = m.status === 'live'
              return (
                <div
                  key={m.match_id}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${m.home_team_name} ${m.home_score ?? ''} - ${m.away_score ?? ''} ${m.away_team_name}\n${fmtTime(m.dateObj)}–${fmtTime(end)} · ${m.status}` })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position: 'absolute', left: `${x1}%`, width: `${Math.max(0.6, x2 - x1)}%`, top: 7, height: 16,
                    background: COL_MATCH, borderRadius: 3,
                    outline: isLive ? `2px solid ${COL_GOOD}` : 'none',
                    animation: isLive ? 'hiLiveBlink 0.7s ease-in-out infinite' : 'none',
                  }}
                >
                  {isLive && (
                    <span style={{ position: 'absolute', top: -13, left: 0, fontSize: 8, fontWeight: 700, color: COL_GOOD, whiteSpace: 'nowrap' }}>
                      LIVE {m.home_score}-{m.away_score}
                    </span>
                  )}
                </div>
              )
            })}

            {scanMoments.map((s, i) => {
              const meta = REASON_META[s.reason] || { label: s.reason, color: 'var(--color-text-muted)' }
              return (
                <div
                  key={i}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${meta.label}\n${fmtTime(s.dateObj)}${poule.is_landelijke ? ' · competitie-breed' : ''}` })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position: 'absolute', left: `${timeToPct(s.dateObj)}%`, top: 10, width: 7, height: 7,
                    background: meta.color, borderRadius: 2, transform: 'translateX(-50%) rotate(45deg)',
                  }}
                />
              )
            })}

            {captures.map((c, i) => (
              <div
                key={i}
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `Echte capture\n${fmtTime(c)}` })}
                onMouseLeave={() => setTooltip(null)}
                style={{ position: 'absolute', left: `${timeToPct(c)}%`, top: -2, width: 8, height: 8, borderRadius: '50%', background: 'var(--color-text)', border: '1px solid var(--color-surface)' }}
              />
            ))}

            {scheduled.map((s, i) => (
              <div
                key={i}
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: s.executed
                  ? `Cmd echt uitgevoerd\n${fmtTime(s.dateObj)}`
                  : `Cmd ingepland (${s.status})\n${fmtTime(s.dateObj)}` })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  position: 'absolute', left: `${timeToPct(s.dateObj)}%`, top: 23, width: 0, height: 0,
                  borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                  borderBottom: `6px solid ${COL_SCHEDULED}`,
                  // echt uitgevoerd (status=done) = volle driehoek, nog niet
                  // uitgevoerd/mislukt = uitgesneden/lichter, zodat je op
                  // oudere dagen kunt zien wat er ECHT is gebeurd i.p.v.
                  // enkel wat ooit is ingepland.
                  opacity: s.executed ? 1 : 0.4,
                }}
              />
            ))}
          </div>
        </div>
        )
      })())}

      {hasAnyManualScanning && pyWeekday >= 5 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', fontSize: 10, color: 'var(--color-text-muted)' }}>
          NIET-AUTOSCAN · WEKELIJKS (werkdagen) · vandaag geen ronde (weekend) · eerstvolgende: {nextManualRoundDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
      )}

      {!!manualPlannedToday.length && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            NIET-AUTOSCAN · WEKELIJKS ({WEEKDAY_LABELS[pyWeekday] || pyWeekday}) · {manualPlannedToday.length} calls naar hockey.nl in {manualCompetitionEntries.length} competities
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {manualCompetitionEntries.slice(0, MANUAL_COMP_SHOWN).map(([name, count]) => (
              <span
                key={name}
                style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '2px 7px' }}
              >
                {name} ({count})
              </span>
            ))}
            {manualCompetitionEntries.length > MANUAL_COMP_SHOWN && (
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                +{manualCompetitionEntries.length - MANUAL_COMP_SHOWN} meer competities
              </span>
            )}
          </div>
        </div>
      )}

      {!!seasonEventsToday.length && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            SEIZOENSKALENDER VANDAAG
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {seasonEventsToday.map((e, i) => (
              <span
                key={i}
                title={e.notes || undefined}
                style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '2px 7px' }}
              >
                🏒 {e.label}{e.rounds ? ` · ${e.rounds} ronden` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {!!clubCapturesToday.length && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            CLUB-SCANS VANDAAG
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {clubCapturesToday.map((c, i) => (
              <span key={i} style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '2px 7px' }}>
                {fmtTime(c.dateObj)} · {c.club_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y + 12, zIndex: 50,
          background: 'var(--color-text)', color: 'var(--color-surface)', fontSize: 11,
          padding: '6px 9px', borderRadius: 6, maxWidth: 260, whiteSpace: 'pre-line', pointerEvents: 'none',
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

const navBtnStyle = {
  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
}
