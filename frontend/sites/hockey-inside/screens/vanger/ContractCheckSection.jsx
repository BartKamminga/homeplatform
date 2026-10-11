import { useState, useEffect } from 'react'
import { getContractCheck, runContractCheck, acceptContractShape } from '../../api.js'
import { ghostBtn, ghostBtnSm } from '../styles.js'

// item 1257: dagelijkse contract-check hockey.nl - per vast testdoel de laatste
// uitkomst van de vormvergelijking, plus recente parse-fouten. Meldingen gaan
// ook via push; dit kaartje is het overzicht en de plek om een bewuste
// wijziging bij hockey.nl als nieuwe basislijn te accepteren.

const OUTCOME = {
  ok:           { label: 'OK',              color: 'var(--color-success, #16a34a)' },
  additions:    { label: 'New fields',      color: 'var(--color-text-muted)' },
  baseline_set: { label: 'Baseline set',    color: 'var(--color-text-muted)' },
  accepted:     { label: 'Accepted',        color: 'var(--color-text-muted)' },
  breach:       { label: 'Shape changed',   color: 'var(--color-danger, #ef4444)' },
}
const CMD_LABEL = { get_poule: 'Poule', get_competition_detail: 'Competition', scan_club: 'Club' }

const fmt = iso => (iso ? new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleString('en-GB') : '—')

function PathList({ title, items, color }) {
  if (!items?.length) return null
  return (
    <div style={{ marginTop: 4 }}>
      <span style={{ color, fontWeight: 600 }}>{title}: </span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{items.join(', ')}</span>
    </div>
  )
}

export default function ContractCheckSection({ section }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => getContractCheck().then(setData).catch(() => {})
  useEffect(() => { load() }, [])

  async function act(fn, done) {
    setBusy(true); setMessage('')
    try { setMessage(done(await fn())); load() }
    catch (e) { setMessage(e.message) }
    finally { setBusy(false) }
  }

  if (!data) return null
  const targets = Object.entries(data.targets || {})
  const parseFailed = Object.entries(data.parse_failed || {})
  const breaches = targets.filter(([type]) => data.results?.[type]?.outcome === 'breach').length

  return (
    <div>
      {section(`${breaches ? '⚠️ ' : ''}hockey.nl contract check`)}
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 10 }}>
        Once a day three fixed requests check whether the shape of hockey.nl's responses is unchanged.
        Last scheduled: {fmt(data.last_run)}
      </div>

      {targets.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          No test targets yet - they are picked on the first run.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {targets.map(([type, target]) => {
            const result = data.results?.[type]
            const outcome = OUTCOME[result?.outcome] || { label: 'Waiting for result', color: 'var(--color-text-muted)' }
            return (
              <div key={type} style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface)',
                border: `1px solid ${result?.outcome === 'breach' ? 'var(--color-danger, #ef4444)' : 'var(--color-border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, minWidth: 82 }}>{CMD_LABEL[type] || type}</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(target.label || '').replace(/^Contract check: /, '')}
                  </span>
                  <span style={{ color: outcome.color, fontWeight: 600 }}>{outcome.label}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{fmt(result?.checked_at)}</span>
                  {result?.outcome === 'breach' && (
                    <button disabled={busy} style={ghostBtnSm}
                      onClick={() => act(() => acceptContractShape(type), () => 'New shape accepted as baseline')}>
                      Accept new shape
                    </button>
                  )}
                </div>
                <PathList title="Removed" items={result?.removed} color="var(--color-danger, #ef4444)" />
                <PathList title="Changed" items={result?.changed} color="var(--color-danger, #ef4444)" />
                <PathList title="New" items={result?.added} color="var(--color-text-muted)" />
              </div>
            )
          })}
        </div>
      )}

      {parseFailed.length > 0 && (
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-warning, #f59e0b)', marginBottom: 4 }}>Recent parse failures</div>
          {parseFailed.map(([type, pf]) => (
            <div key={type} style={{ color: 'var(--color-text-muted)' }}>
              {type} · {pf.label || '—'} · {fmt(pf.at)}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button disabled={busy} style={ghostBtn}
          onClick={() => act(runContractCheck, r => `${r.queued} request(s) queued - Ghost picks them up on its next run`)}>
          {busy ? 'Busy…' : 'Run now'}
        </button>
        {message && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{message}</span>}
      </div>
    </div>
  )
}
