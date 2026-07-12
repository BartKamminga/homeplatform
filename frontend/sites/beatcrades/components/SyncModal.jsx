import { useState, useEffect } from 'react'
import { syncPreview, syncExecute } from '../api.js'

const SYNC_TYPE_META = {
  create_dir:     { label: 'Aanmaken op disk',    icon: '📁', cls: 'add' },
  reorganize_dir: { label: 'Structuur aanpassen', icon: '🗂️', cls: 'upd' },
  clear_output:   { label: 'DB bijwerken',         icon: '🔗', cls: 'upd' },
  mark_missing:   { label: 'Ontbrekend markeren', icon: '⚠️', cls: 'del' },
  add_from_disk:  { label: 'Nieuw vanuit disk',   icon: '📥', cls: 'new' },
}

export function SyncModal({ onClose, onDone }) {
  const [loading,   setLoading]   = useState(true)
  const [actions,   setActions]   = useState([])
  const [dlRoot,    setDlRoot]    = useState('')
  const [selected,  setSelected]  = useState({})
  const [executing, setExecuting] = useState(false)
  const [results,   setResults]   = useState(null)

  useEffect(() => {
    syncPreview()
      .then(data => {
        setActions(data.actions)
        setDlRoot(data.download_root)
        const sel = {}
        data.actions.forEach(a => { sel[a.id] = a.selected })
        setSelected(sel)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = id => setSelected(s => ({ ...s, [id]: !s[id] }))

  const toggleGroup = type => {
    const ofType = actions.filter(a => a.type === type)
    const allOn  = ofType.every(a => selected[a.id])
    setSelected(s => {
      const n = { ...s }
      ofType.forEach(a => { n[a.id] = !allOn })
      return n
    })
  }

  const execute = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!ids.length) return
    setExecuting(true)
    try {
      const res = await syncExecute(ids)
      setResults(res.results)
      onDone?.()
    } catch (e) {
      setResults([{ id: '_err', ok: false, message: e.message || 'Onbekende fout' }])
    }
    setExecuting(false)
  }

  const selCount = Object.values(selected).filter(Boolean).length
  const groups   = Object.entries(SYNC_TYPE_META)
    .map(([type, meta]) => ({ type, meta, items: actions.filter(a => a.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="bc-dlg-overlay" onClick={onClose}>
      <div className="bc-sync-modal" onClick={e => e.stopPropagation()}>

        <div className="bc-sync-hdr">
          <div>
            <div className="bc-sync-hdr-eyebrow">BeatCrades · Disk-Sync</div>
            <div className="bc-sync-hdr-title">Vergelijking database ↔ schijf</div>
          </div>
          <button className="bc-del-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="bc-sync-empty">Scannen…</div>

        ) : results ? (
          <>
            <div className="bc-sync-body">
              {results.map(r => (
                <div key={r.id} className={`bc-sync-result-card${r.ok ? ' ok' : ' fail'}`}>
                  <span className="bc-sync-result-icon">{r.ok ? '✓' : '✕'}</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
            <div className="bc-sync-footer">
              <span />
              <button className="bc-btn bc-btn-pri" onClick={onClose}>Sluiten</button>
            </div>
          </>

        ) : groups.length === 0 ? (
          <>
            <div className="bc-sync-empty">✓ Alles is al gesynchroniseerd.</div>
            <div className="bc-sync-footer">
              <span />
              <button className="bc-btn bc-btn-sec" onClick={onClose}>Sluiten</button>
            </div>
          </>

        ) : (
          <>
            <div className="bc-sync-meta">
              <span className="bc-sync-meta-chip">🗂 {dlRoot}</span>
              <span className="bc-sync-meta-chip">📦 {actions.length} item{actions.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="bc-sync-legend">
              {Object.entries(SYNC_TYPE_META).map(([type, m]) => (
                <span key={type} className={`bc-sync-leg bc-sync-leg--${m.cls}`}>
                  <span className="bc-sync-leg-dot" />
                  {m.label}
                </span>
              ))}
            </div>

            <div className="bc-sync-body">
              {groups.map(({ type, meta, items }) => (
                <div key={type} className="bc-sync-action-group">
                  <div className="bc-sync-group-sep" onClick={() => toggleGroup(type)}>
                    <span className={`bc-sync-sep-label bc-sync-sep--${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="bc-sync-sep-count">
                      {items.filter(a => selected[a.id]).length}/{items.length} geselecteerd
                    </span>
                  </div>
                  <div className="bc-sync-cards">
                    {items.map(a => (
                      <label key={a.id} className={`bc-sync-card bc-sync-card--${meta.cls}${selected[a.id] ? ' checked' : ''}`}>
                        <input
                          type="checkbox"
                          className="bc-sync-cb"
                          checked={!!selected[a.id]}
                          onChange={() => toggle(a.id)}
                        />
                        <span className={`bc-sync-card-icon bc-sync-card-icon--${meta.cls}`}>{meta.icon}</span>
                        <div className="bc-sync-card-body">
                          <span className="bc-sync-card-name">{a.crade_name}</span>
                          <span className="bc-sync-card-desc">{a.description}</span>
                          <code className="bc-sync-card-path">{a.rel_path}</code>
                        </div>
                        <span className={`bc-sync-badge bc-sync-badge--${meta.cls}`}>{meta.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bc-sync-footer">
              <span className="bc-sync-sel">{selCount} actie{selCount !== 1 ? 's' : ''} geselecteerd</span>
              <button className="bc-btn bc-btn-sec" onClick={onClose}>Annuleren</button>
              <button className="bc-btn bc-btn-pri" disabled={!selCount || executing} onClick={execute}>
                {executing ? 'Bezig…' : 'Sync uitvoeren'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
