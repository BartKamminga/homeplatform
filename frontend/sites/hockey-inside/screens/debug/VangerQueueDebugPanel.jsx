import { useState, useEffect, useCallback, useRef } from 'react'
import { browseVangerQueue, previewNextVangerCmd } from '../../api.js'
import { inputStyle, ghostBtn, muted } from '../styles.js'

const PAGE_SIZE = 50

const STATUS_OPTIONS = ['', 'pending', 'in_progress', 'done', 'failed', 'skipped']
const CMD_TYPE_OPTIONS = ['', 'get_poule', 'scan_club', 'get_clubs', 'get_competition_detail', 'get_competitions']

const STATUS_COLORS = {
  pending: 'var(--color-text-muted)', in_progress: 'var(--color-primary)',
  done: 'var(--color-success)', failed: 'var(--color-danger)', skipped: 'var(--color-text-muted)',
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

// De echte uitvoeringsqueue (VangerCmd) - wat Ghost/Scout daadwerkelijk
// afwerkt. Los van het scanschema (ScanScheduleEntry, zie
// ScheduleDebugPanel.jsx) - die twee mogen niet met elkaar verward worden.
export default function VangerQueueDebugPanel() {
  const [status, setStatus] = useState('')
  const [cmdType, setCmdType] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // "Laatste aanvraag wint" i.p.v. "laatst binnengekomen antwoord wint" - zie
  // ScheduleDebugPanel.jsx voor de volledige toelichting (dezelfde bugklasse
  // kan hier ook optreden bij snel achter elkaar wisselende filters).
  const requestIdRef = useRef(0)
  const load = useCallback(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    browseVangerQueue({ status, cmd_type: cmdType, search, limit: PAGE_SIZE, offset })
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
  }, [status, cmdType, search, offset])

  useEffect(() => { load() }, [load])

  function updateFilter(setter) {
    return e => { setter(e.target.value); setOffset(0) }
  }

  function runPreview() {
    setPreviewLoading(true)
    previewNextVangerCmd().then(setPreview).catch(e => setError(e.message)).finally(() => setPreviewLoading(false))
  }

  const from = data.total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, data.total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={status} onChange={updateFilter(setStatus)} style={inputStyle}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'Alle statussen'}</option>)}
        </select>
        <select value={cmdType} onChange={updateFilter(setCmdType)} style={inputStyle}>
          {CMD_TYPE_OPTIONS.map(c => <option key={c} value={c}>{c || 'Alle cmd-types'}</option>)}
        </select>
        <input
          value={search}
          onChange={updateFilter(setSearch)}
          placeholder="Zoek in params (label, poule_id, ...)"
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <button onClick={load} style={ghostBtn}>Ververs</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
        <button onClick={runPreview} disabled={previewLoading} style={ghostBtn}>
          {previewLoading ? 'Bezig…' : 'Preview volgende (simulatie, muteert niets)'}
        </button>
        {preview && (
          preview.found
            ? <span style={{ fontSize: 12 }}>
                #{preview.id} <strong>{preview.cmd_type}</strong> {preview.params?.label || JSON.stringify(preview.params)}
                {!!preview.skipped_count && <span style={{ color: 'var(--color-text-muted)' }}> ({preview.skipped_count} overgeslagen door queue-filter)</span>}
              </span>
            : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Geen enkele pending cmd valt binnen de actieve queue-filter ({preview.skipped_count} overgeslagen)
              </span>
        )}
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}
      {loading && <div style={muted}>Laden…</div>}

      {!loading && data.items.length === 0 && <div style={muted}>Geen cmd's gevonden voor deze filters.</div>}

      {!loading && data.items.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '4px 6px' }}>ID</th>
                <th style={{ padding: '4px 6px' }}>Type</th>
                <th style={{ padding: '4px 6px' }}>Status</th>
                <th style={{ padding: '4px 6px' }}>Label / params</th>
                <th style={{ padding: '4px 6px' }}>Aangemaakt</th>
                <th style={{ padding: '4px 6px' }}>Filter</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: item.in_active_filter ? 1 : 0.5 }}>
                  <td style={{ padding: '4px 6px' }}>{item.id}</td>
                  <td style={{ padding: '4px 6px' }}>{item.cmd_type}</td>
                  <td style={{ padding: '4px 6px', color: STATUS_COLORS[item.status] || 'inherit' }}>{item.status}</td>
                  <td style={{ padding: '4px 6px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={item.error || JSON.stringify(item.params)}>
                    {item.params?.label || JSON.stringify(item.params)}
                    {item.error && <span style={{ color: 'var(--color-danger)' }}> · {item.error}</span>}
                  </td>
                  <td style={{ padding: '4px 6px' }}>{fmtTime(item.created_at)}</td>
                  <td style={{ padding: '4px 6px' }} title={item.in_active_filter ? undefined : 'Buiten de actieve queue-filter'}>
                    {item.in_active_filter ? '✓' : '—'}
                  </td>
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
