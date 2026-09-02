import { useState, useEffect, useCallback, useRef } from 'react'
import { browseSchedule, getScheduleSummary, promoteScheduleNow, rebuildScheduleNow } from '../../api.js'
import { inputStyle, ghostBtn, muted } from '../styles.js'

const PAGE_SIZE = 50

const STATUS_OPTIONS = ['', 'planned', 'promoted', 'cancelled']
const REASON_OPTIONS = [
  '', 'match_start_check', 'match_end_check', 'retry_match_end', 'match_live', 'daily_fallback',
  'manual_weekly', 'unknown_start_recheck', 'new_or_empty', 'club_scan', 'club_list',
]
const TARGET_TYPE_OPTIONS = ['', 'poule', 'competition', 'club']

const STATUS_COLORS = {
  planned: 'var(--color-primary)', promoted: 'var(--color-success)', cancelled: 'var(--color-danger)',
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

// Het SCANSCHEMA (ScanScheduleEntry, item 1015) - de vooraf berekende,
// toekomstgerichte planning (Fase A, schaduw-modus: stuurt de echte
// uitvoering nog niet aan). Los van de echte uitvoeringsqueue (VangerCmd,
// zie VangerQueueDebugPanel.jsx).
export default function ScheduleDebugPanel({ initialFilter, onFilterConsumed }) {
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState(null)
  const [dateFilter, setDateFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState({ total: 0, items: [] })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildMsg, setRebuildMsg] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoteMsg, setPromoteMsg] = useState('')

  // Doorgelinkt vanuit de Kalender-tab (🔍 debug op een poule-rij) - vult
  // target_type/target_id/date alvast in, status wordt bewust leeg gelaten
  // (je wilt dan zowel planned als al gepromoveerde momenten voor die dag zien).
  useEffect(() => {
    if (!initialFilter) return
    setTargetType(initialFilter.target_type || '')
    setTargetId(initialFilter.target_id ?? null)
    setDateFilter(initialFilter.date || null)
    setStatus('')
    setReason('')
    setSearch('')
    setOffset(0)
    onFilterConsumed?.()
  }, [initialFilter, onFilterConsumed])

  // "Laatste aanvraag wint" i.p.v. "laatst binnengekomen antwoord wint" - een
  // doorgelinkt filter vanuit de Kalender zet meerdere states tegelijk (via
  // de useEffect hierboven), wat 2 fetches vlak na elkaar triggert (1x met
  // de oude, nog-lege filterwaarden, 1x met de nieuwe). Zonder deze guard
  // kan het antwoord van de EERSTE (verouderde, ongefilterde) aanvraag later
  // binnenkomen en de correcte, gefilterde resultaten overschrijven.
  const requestIdRef = useRef(0)
  const load = useCallback(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    browseSchedule({ status, reason, target_type: targetType, target_id: targetId, date: dateFilter, search, limit: PAGE_SIZE, offset })
      .then(d => {
        if (requestIdRef.current !== requestId) return
        setData(d); setError('')
      })
      .catch(e => {
        if (requestIdRef.current !== requestId) return
        setError(e.message || 'Laden mislukt')
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false)
      })
  }, [status, reason, targetType, targetId, dateFilter, search, offset])

  const loadSummary = useCallback(() => { getScheduleSummary().then(setSummary).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  // Handmatige rebuild-trigger (Bart, 30-08-2026: "kan er niet een button
  // komen dan ik het zelf kan doen?") - nodig zolang scan_plan_enabled=0 en
  // de periodieke rebuild dus niet vanzelf draait. Herberekent alleen de
  // scanschema-PREVIEW, start geen echte scan.
  function rebuildNow() {
    setRebuilding(true)
    setRebuildMsg('')
    rebuildScheduleNow()
      .then(r => {
        setRebuildMsg(`Herbouwd: ${r.event_count} events`)
        load()
        loadSummary()
      })
      .catch(e => setRebuildMsg(e.message || 'Herbouwen mislukt'))
      .finally(() => setRebuilding(false))
  }

  // Handmatige promotie-trigger (item 1026, Bart, 31-08-2026: "handmatig
  // versnellen van de queue moet mogelijk zijn") - i.t.t. rebuildNow hierboven
  // heeft dit een ECHT effect: due scanschema-entries komen nu meteen in de
  // vanger-queue terecht i.p.v. te wachten op de eerstvolgende periodieke
  // cyclus (profile_scan_interval_min).
  //
  // item 1032 (Bart, 1-09-2026): "versnellen kijk niet over dagen heen?" +
  // "echt tijdgebonden items niet noodzakelijkerwijs eerder uitvoeren, alleen
  // poules met missende starttijden, clubs/club zaken" - de backend past de
  // ACCELERATABLE_REASONS-whitelist toe (unknown_start_recheck/club_scan/
  // club_list/new_or_empty), deze UI hoeft alleen de preset te kiezen.
  const [promotePreset, setPromotePreset] = useState('due')
  function promoteNow() {
    setPromoting(true)
    setPromoteMsg('')
    const opts = {
      due:                    { mode: 'hours', withinHours: 0 },
      hours24:                { mode: 'hours', withinHours: 24 },
      days3:                  { mode: 'hours', withinHours: 72 },
      tomorrow:               { mode: 'tomorrow' },
      until_next_start_check: { mode: 'until_next_start_check' },
      next10:                 { mode: 'count', limit: 10 },
    }[promotePreset]
    promoteScheduleNow(opts)
      .then(r => {
        setPromoteMsg(`${r.promoted} gepromoveerd naar de queue`)
        load()
        loadSummary()
      })
      .catch(e => setPromoteMsg(e.message || 'Promoveren mislukt'))
      .finally(() => setPromoting(false))
  }

  function clearLinkedFilter() {
    setTargetId(null)
    setDateFilter(null)
    setOffset(0)
  }

  function updateFilter(setter) {
    return e => { setter(e.target.value); setOffset(0) }
  }

  const from = data.total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, data.total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span>Totaal: <strong>{summary.total}</strong></span>
          {Object.entries(summary.by_status).map(([k, v]) => (
            <span key={k}>{k}: <strong>{v}</strong></span>
          ))}
          <span style={{ opacity: 0.5 }}>|</span>
          {Object.entries(summary.by_reason_planned).map(([k, v]) => (
            <span key={k}>{k}: <strong>{v}</strong></span>
          ))}
        </div>
      )}

      {(targetId != null || dateFilter) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12 }}>
          <span>Doorgelinkt vanuit de Kalender:{' '}
            {targetId != null && <strong>{targetType} #{targetId}</strong>}
            {targetId != null && dateFilter && ' · '}
            {dateFilter && <strong>{dateFilter}</strong>}
          </span>
          <button onClick={clearLinkedFilter} style={ghostBtn}>Wis</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={status} onChange={updateFilter(setStatus)} style={inputStyle}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'Alle statussen'}</option>)}
        </select>
        <select value={reason} onChange={updateFilter(setReason)} style={inputStyle}>
          {REASON_OPTIONS.map(r => <option key={r} value={r}>{r || 'Alle redenen'}</option>)}
        </select>
        <select value={targetType} onChange={updateFilter(setTargetType)} style={inputStyle}>
          {TARGET_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t || 'Alle target-types'}</option>)}
        </select>
        <input
          value={search}
          onChange={updateFilter(setSearch)}
          placeholder="Zoek op poule/competitie/club-naam"
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <button onClick={load} style={ghostBtn}>Ververs</button>
        <button
          onClick={rebuildNow}
          disabled={rebuilding}
          title="Herberekent het scanschema nu meteen (geen echte scan) - handig zolang Scan-plan actief uit staat en de periodieke rebuild dus niet vanzelf draait."
          style={{ ...ghostBtn, opacity: rebuilding ? 0.6 : 1 }}
        >
          🔄 {rebuilding ? 'Bezig...' : 'Nu herbouwen'}
        </button>
        {rebuildMsg && <span style={muted}>{rebuildMsg}</span>}
        <select
          value={promotePreset}
          onChange={e => setPromotePreset(e.target.value)}
          title="Niet-wedstrijd-gebonden items (missende starttijden, clubs) mogen vervroegd worden; wedstrijd-timing en resultaat-checks (daily_fallback/manual_weekly/match_*) blijven altijd op hun natuurlijke tijdstip staan."
          style={{ ...inputStyle, minWidth: 170 }}
        >
          <option value="due">Alleen wat nu due is</option>
          <option value="hours24">Ook komende 24u</option>
          <option value="days3">Ook komende 3 dagen</option>
          <option value="tomorrow">Alles van morgen</option>
          <option value="until_next_start_check">Tot eerste match-start-check</option>
          <option value="next10">Volgende 10 items</option>
        </select>
        <button
          onClick={promoteNow}
          disabled={promoting}
          title="Promoveert scanschema-entries binnen de gekozen preset nu meteen naar de echte vanger-queue en maakt Ghost wakker indien nodig."
          style={{ ...ghostBtn, opacity: promoting ? 0.6 : 1 }}
        >
          ⏩ {promoting ? 'Bezig...' : 'Queue nu versnellen'}
        </button>
        {promoteMsg && <span style={muted}>{promoteMsg}</span>}
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}
      {loading && <div style={muted}>Laden…</div>}

      {!loading && data.items.length === 0 && (
        <div style={muted}>Geen scanschema-rijen gevonden voor deze filters.</div>
      )}

      {!loading && data.items.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '4px 6px' }}>ID</th>
                <th style={{ padding: '4px 6px' }}>Doel</th>
                <th style={{ padding: '4px 6px' }}>Reden</th>
                <th style={{ padding: '4px 6px' }}>Uitleg</th>
                <th style={{ padding: '4px 6px' }}>Status</th>
                <th style={{ padding: '4px 6px' }}>Gepland op</th>
                <th style={{ padding: '4px 6px' }}>Vanger-cmd</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '4px 6px' }}>{item.id}</td>
                  <td style={{ padding: '4px 6px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
                    {item.label}
                  </td>
                  <td style={{ padding: '4px 6px' }}>{item.reason}</td>
                  <td
                    style={{ padding: '4px 6px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}
                    title={item.explanation}
                  >
                    {item.explanation}
                  </td>
                  <td style={{ padding: '4px 6px', color: STATUS_COLORS[item.status] || 'inherit' }}>
                    {item.status}
                    {item.filtered_out && (
                      <span style={{ color: 'var(--color-warning)', fontSize: 10, marginLeft: 4 }} title="Bij promotie buiten het queue-filter gevallen (leeftijd/geslacht/hockeytype) - daarom niet naar de Vanger-queue gestuurd">
                        · buiten filter
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '4px 6px' }}>{fmtTime(item.planned_at)}</td>
                  <td style={{ padding: '4px 6px' }}>{item.vanger_cmd_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span>{from}–{to} van {data.total}</span>
            <button onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0} style={ghostBtn}>← Vorige</button>
            <button onClick={() => setOffset(o => o + PAGE_SIZE)} disabled={to >= data.total} style={ghostBtn}>Volgende →</button>
          </div>
        </>
      )}
    </div>
  )
}
