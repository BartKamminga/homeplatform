import { useState, useEffect } from 'react'
import { syncPreview, syncExecute } from '../../api.js'

// Tab Sync (item 1338): bibliotheek vergelijken met de schijf en gekozen acties uitvoeren.
const TYPES = {
  create_dir:     { label: 'CREATE ON DISK', badge: 'NEW', cls: 'done', color: 'var(--ac-ok)' },
  reorganize_dir: { label: 'RESTRUCTURE', badge: 'UPD', cls: 'queued', color: 'var(--ac-yellow)' },
  clear_output:   { label: 'UPDATE DATABASE', badge: 'UPD', cls: 'queued', color: 'var(--ac-yellow)' },
  mark_missing:   { label: 'MARK MISSING', badge: 'DEL', cls: 'error', color: 'var(--ac-pink)' },
  add_from_disk:  { label: 'NEW FROM DISK', badge: 'NEW', cls: 'busy', color: 'var(--ac-cyan)' },
}

export default function SyncTab({ onDone, onClose }) {
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState([])
  const [root, setRoot] = useState('')
  const [selected, setSelected] = useState({})
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    syncPreview().then(d => {
      setActions(d.actions); setRoot(d.download_root)
      setSelected(Object.fromEntries(d.actions.map(a => [a.id, a.selected])))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggle = id => setSelected(s => ({ ...s, [id]: !s[id] }))
  const toggleGroup = type => {
    const items = actions.filter(a => a.type === type)
    const allOn = items.every(a => selected[a.id])
    setSelected(s => ({ ...s, ...Object.fromEntries(items.map(a => [a.id, !allOn])) }))
  }

  async function run() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!ids.length) return
    setRunning(true)
    try { const res = await syncExecute(ids); setResults(res.results); onDone?.() }
    catch (e) { setResults([{ id: '_err', ok: false, message: e.message || 'Unknown error' }]) }
    setRunning(false)
  }

  if (loading) return <div className="ac-state"><div className="ac-big-msg ac-blink" style={{ fontSize: 14 }}>SCANNING…</div></div>

  if (results) return (
    <div className="bca-tab">
      {results.map(r => (
        <div key={r.id} className="bca-sync-card" style={{ borderColor: r.ok ? 'var(--ac-ok)' : 'var(--ac-pink)' }}>
          <span style={{ color: r.ok ? 'var(--ac-ok)' : 'var(--ac-pink)' }}>{r.ok ? '✓' : '✕'}</span><span>{r.message}</span>
        </div>
      ))}
      <button type="button" className="ac-btn ac-btn--primary" onClick={onClose}>CLOSE</button>
    </div>
  )

  const groups = Object.entries(TYPES).map(([type, meta]) => ({ type, meta, items: actions.filter(a => a.type === type) })).filter(g => g.items.length)
  if (!groups.length) return <div className="ac-state"><div className="ac-big-msg" style={{ color: 'var(--ac-ok)', fontSize: 14 }}>ALL IN SYNC</div></div>
  const count = Object.values(selected).filter(Boolean).length

  return (
    <div className="bca-tab">
      <p className="ac-hint">Compares the library with <code className="bca-code">{root}</code> ({actions.length} items). Pick the changes to apply.</p>
      {groups.map(({ type, meta, items }) => (
        <div key={type} className="bca-sync-group">
          <button type="button" className="bca-sync-head" style={{ color: meta.color }} onClick={() => toggleGroup(type)}>
            {meta.label}<span>{items.filter(a => selected[a.id]).length}/{items.length} SELECTED</span>
          </button>
          {items.map(a => (
            <label key={a.id} className={`bca-sync-card${selected[a.id] ? ' on' : ''}`}>
              <input type="checkbox" checked={!!selected[a.id]} onChange={() => toggle(a.id)} />
              <span className="bca-sync-body"><b>{a.crade_name}</b><small>{a.description}</small><code className="bca-code">{a.rel_path}</code></span>
              <span className={`ac-pill ${meta.cls}`}>{meta.badge}</span>
            </label>
          ))}
        </div>
      ))}
      <button type="button" className="ac-btn ac-btn--primary" disabled={!count || running} onClick={run}>{running ? 'RUNNING…' : `APPLY ${count}`}</button>
    </div>
  )
}
