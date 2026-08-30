import { useState } from 'react'

// Gevalideerde categorale kleuren (dataviz-skill, validate_palette.js) -
// blauw=wedstrijd, oranje=burst-scanvenster. Los van het thema omdat dit een
// vaste, betekenisvolle 2-kleuren-encodering is, geen merk-kleur.
const COL_MATCH     = '#2a78d6'
const COL_BURST     = '#eb6834'
const COL_GOOD      = '#0ca30c'
const COL_SCHEDULED = '#eda100' // cmd aangemaakt/ingepland - los van of hij al is uitgevoerd (dat is de zwarte stip)

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

export default function DagView({ data, date, onDateChange }) {
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
        matches: [], memberPouleIds: [],
      })
    }
    const group = landelijkeGroups.get(key)
    group.matches.push(...poule.matches)
    group.memberPouleIds.push(poule.poule_id)
    group.followed = group.followed || poule.followed
    group.in_active_filter = group.in_active_filter || poule.in_active_filter
  }
  const groupedPoules = [...regularPoules, ...landelijkeGroups.values()]

  const rows = groupedPoules
    .map(poule => {
      const matches = poule.matches
        .map(m => ({ ...m, dateObj: new Date(m.date) }))
        .filter(m => sameDay(m.dateObj, date))
        .sort((a, b) => a.dateObj - b.dateObj)
      if (!matches.length) return null
      const ends = matches.map(m => new Date(m.dateObj.getTime() + settings.match_duration_min * 60000))
      const burstStart = new Date(Math.min(...ends.map(d => d.getTime())))
      // Alleen scan_profile='active'-poules krijgen matchday-burst/live-check
      // van het echte scan-plan (_step_active_profiles) - manual-profile en
      // followed_only-poules (competitie zelf niet op autoscan) krijgen
      // hoogstens de wekelijkse niet-autoscan-ronde. Zonder deze check liet
      // DagView een burst-balk + "N scans gepland" zien voor ELKE poule,
      // ook de ~200 manual-profile competities die in werkelijkheid maar
      // 1x per week gescand worden - misleidend.
      const isAutoscan = poule.is_landelijke || poule.scan_profile === 'active'
      // De echte scan-plan-code (_step_active_profiles) heeft GEEN harde
      // stop voor burst-modus - hij blijft actief zolang het "vandaag" is,
      // dus minimaal tot de LAATSTE wedstrijd van de poule is afgelopen
      // (was eerder een vaste 3u-aanname na de EERSTE wedstrijd, wat het
      // venster te vroeg liet stoppen bij meerdere, verspreide wedstrijden
      // in dezelfde poule).
      const lastEnd = new Date(Math.max(...ends.map(d => d.getTime())))
      const allFinal = matches.every(m => m.status === 'final')
      // Burst-modus stopt zodra alles bekend is (allFinal) OF
      // burst_stop_hours_after_last_match uur na de LAATSTE wedstrijd -
      // hij loopt dus niet meer standaard door tot het einde van de dag
      // (dat kostte onnodige calls naar hockey.nl, tegen het uitgangspunt
      // "zo min mogelijk calls" in).
      const burstDeadline = new Date(lastEnd.getTime() + settings.burst_stop_hours_after_last_match * 3600000)
      const burstEnd = !isAutoscan ? null : poule.is_landelijke
        // landelijke competities volgen de eigen 12u-cadans, niet de
        // matchday-burst - het venster hier is dus alleen indicatief voor
        // "wanneer wordt de HELE competitie weer in 1x ververst".
        ? new Date(burstStart.getTime() + settings.landelijke_comp_scan_hours * 3600000)
        : (allFinal ? lastEnd : burstDeadline)
      const ticks = (!isAutoscan || poule.is_landelijke || allFinal) ? [] : (() => {
        const t = []
        for (let time = burstStart.getTime(); time < burstEnd.getTime(); time += settings.active_matchday_interval_min * 60000) {
          t.push(new Date(time))
        }
        return t
      })()
      const memberIds = poule.memberPouleIds || [poule.poule_id]
      const captures = (recentCaptures || [])
        .filter(c => memberIds.includes(c.poule_id))
        .map(c => new Date(c.captured_at))
        .filter(d => sameDay(d, date))
      const scheduled = (data.scheduled_cmds || [])
        .filter(c => memberIds.includes(c.poule_id))
        .map(c => ({ dateObj: new Date(c.event_at || c.scheduled_at), status: c.status, executed: c.executed }))
        .filter(c => sameDay(c.dateObj, date))
      const scanCount = !isAutoscan ? 0 : (poule.is_landelijke ? 1 : ticks.length)
      // Zodra de burst-modus is gestopt (allFinal of voorbij de deadline),
      // is de dagelijkse fallback het eerstvolgende scanmoment - zichtbaar
      // maken i.p.v. dat het lijkt alsof er niets meer gepland staat.
      const burstOver = isAutoscan && !poule.is_landelijke && (allFinal || date < new Date() && burstEnd < new Date())
      const nextFallbackScan = (burstOver && poule.last_scanned_at)
        ? new Date(new Date(poule.last_scanned_at).getTime() + settings.active_daily_fallback_hours * 3600000)
        : null
      return { poule, matches, burstStart, burstEnd, ticks, captures, scheduled, scanCount, nextFallbackScan, isAutoscan }
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
  // gescand, verdeeld over maandag/vrijdag (_step_manual_profiles_weekly) -
  // JS getDay() (zo=0..za=6) omzetten naar dezelfde ma=0..zo=6-telling als
  // de backend (comp.id % 2 bepaalt maandag of vrijdag).
  const pyWeekday = (date.getDay() + 6) % 7
  const manualPoulesToday = (data.manual_poules || []).filter(p => p.assigned_weekday === pyWeekday)
  // Kan in de praktijk honderden poules per dag zijn (alle niet-autoscan
  // publicaties samen) - per competitie samenvatten i.p.v. 1 badge per poule,
  // anders wordt de sectie onleesbaar.
  const manualByCompetition = new Map()
  for (const p of manualPoulesToday) {
    const key = p.competition_name || '(onbekende competitie)'
    manualByCompetition.set(key, (manualByCompetition.get(key) || 0) + 1)
  }
  const manualCompetitionEntries = [...manualByCompetition.entries()].sort((a, b) => b[1] - a[1])
  const MANUAL_COMP_SHOWN = 20
  const totalManualPoules = (data.manual_poules || []).length
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

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => shiftDay(-1)} style={navBtnStyle}>←</button>
        <strong style={{ fontSize: 13 }}>{date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <button onClick={() => shiftDay(1)} style={navBtnStyle}>→</button>
        <button onClick={() => onDateChange(new Date())} style={{ ...navBtnStyle, marginLeft: 'auto' }}>Vandaag</button>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '8px 14px', fontSize: 11, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 7, background: COL_MATCH, borderRadius: 2, marginRight: 4 }} />Wedstrijd</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 7, background: `repeating-linear-gradient(45deg, ${COL_BURST}, ${COL_BURST} 2px, transparent 2px, transparent 4px)`, border: `1px solid ${COL_BURST}`, borderRadius: 2, marginRight: 4 }} />Burst-scanvenster</span>
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
        const { poule, matches, burstStart, burstEnd, ticks, captures, scheduled, scanCount, nextFallbackScan, isAutoscan } = item.row
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
                ? poule.competition_name
                : `${poule.poule_name} · ${matches.length} wedstrijd${matches.length === 1 ? '' : 'en'}`}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
              {poule.is_landelijke
                ? `${poule.memberPouleIds.length} poules samen · 1 get_competition_detail-call ververst ze allemaal · elke ${settings.landelijke_comp_scan_hours}u`
                : (item.grouped ? '' : poule.competition_name)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>
              {isAutoscan
                ? `${scanCount} scan${scanCount === 1 ? '' : 's'} gepland vandaag`
                : 'niet-autoscan · wekelijkse ronde (zie onderaan)'}
            </div>
            {nextFallbackScan && (
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>
                burst gestopt · volgende scan (dagelijkse fallback) {fmtTime(nextFallbackScan)} {nextFallbackScan.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
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

            {isAutoscan && (
              <div
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: poule.is_landelijke
                  ? `Competitie-brede herscan\n${fmtTime(burstStart)}–${fmtTime(burstEnd)}\nelke ${settings.landelijke_comp_scan_hours}u, ververst alle ${poule.memberPouleIds.length} poules in 1x`
                  : `Burst-scanvenster\n${fmtTime(burstStart)}–${fmtTime(burstEnd)}\nelke ${settings.active_matchday_interval_min} min\nstopt zodra alles bekend is, of uiterlijk ${settings.burst_stop_hours_after_last_match}u na de laatste wedstrijd` })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  position: 'absolute', left: `${timeToPct(burstStart)}%`, width: `${Math.max(0.6, timeToPct(burstEnd) - timeToPct(burstStart))}%`,
                  top: 7, height: 16, borderRadius: 3, border: `1px solid ${COL_BURST}`,
                  background: `repeating-linear-gradient(45deg, ${COL_BURST} 0, ${COL_BURST} 3px, color-mix(in srgb, ${COL_BURST} 25%, transparent) 3px, color-mix(in srgb, ${COL_BURST} 25%, transparent) 6px)`,
                }}
              />
            )}
            {ticks.map((t, i) => (
              <div key={i} style={{ position: 'absolute', left: `${timeToPct(t)}%`, top: 4, width: 2, height: 22, background: COL_BURST, opacity: 0.55, borderRadius: 1 }} />
            ))}

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

      {!!totalManualPoules && !manualPoulesToday.length && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', fontSize: 10, color: 'var(--color-text-muted)' }}>
          NIET-AUTOSCAN · WEKELIJKS (werkdagen) · vandaag geen ronde (weekend) · eerstvolgende: {nextManualRoundDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
      )}

      {!!manualPoulesToday.length && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            NIET-AUTOSCAN · WEKELIJKS ({WEEKDAY_LABELS[pyWeekday] || pyWeekday}) · {manualPoulesToday.length} poules in {manualCompetitionEntries.length} competities
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
