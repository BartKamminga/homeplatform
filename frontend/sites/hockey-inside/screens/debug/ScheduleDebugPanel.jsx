import { useState, useEffect, useCallback } from 'react'
import { browseSchedule, getScheduleSummary } from '../../api.js'
import { inputStyle, ghostBtn, muted } from '../styles.js'

const PAGE_SIZE = 50

const STATUS_OPTIONS = ['', 'planned', 'promoted', 'cancelled']
const REASON_OPTIONS = [
  '', 'matchday_burst', 'daily_fallback', 'live_check', 'manual_weekly',
  'unknown_start_recheck', 'new_or_empty', 'club_scan', 'club_list',
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
export default function ScheduleDebugPanel() {
  const [status, setStatus] = useState('planned')
  const [reason, setReason] = useState('')
  const [targetType, setTargetType] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState({ total: 0, items: [] })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    browseSchedule({ status, reason, target_type: targetType, search, limit: PAGE_SIZE, offset })
      .then(d => { setData(d); setError('') })
      .catch(e => setError(e.message || 'Laden mislukt'))
      .finally(() => setLoading(false))
  }, [status, reason, targetType, search, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => { getScheduleSummary().then(setSummary).catch(() => {}) }, [])

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
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}
      {loading && <div style={muted}>Laden…</div>}

      {!loading && data.items.length === 0 && <div style={muted}>Geen scanschema-rijen gevonden voor deze filters.</div>}

      {!loading && data.items.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '4px 6px' }}>ID</th>
                <th style={{ padding: '4px 6px' }}>Doel</th>
                <th style={{ padding: '4px 6px' }}>Reden</th>
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
                  <td style={{ padding: '4px 6px', color: STATUS_COLORS[item.status] || 'inherit' }}>{item.status}</td>
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
