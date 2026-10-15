import { useEffect, useState } from 'react'
import { deleteEntry, downloadEntry, listEntries, updateEntry } from '../api.js'
import { formatDate, formatSize, KIND_LABELS } from '../format.js'

const FILTERS = [['', 'All'], ['mail', 'Mail'], ['document', 'Documents'], ['note', 'Notes'], ['link', 'Links'], ['session', 'Sessions']]

export default function EntryList({ dossier, version, onChanged }) {
  const [entries, setEntries] = useState(null)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [confirmId, setConfirmId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      listEntries(dossier.id, { q: q.trim() || undefined, kind: kind || undefined }).then(setEntries).catch((e) => setError(e.message))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [dossier.id, q, kind, version])

  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  async function togglePin(entry) {
    try { await updateEntry(entry.id, { pinned: !entry.pinned }); onChanged() } catch (e) { setError(e.message) }
  }

  async function remove(entry) {
    try { await deleteEntry(entry.id); setConfirmId(null); onChanged() } catch (e) { setError(e.message) }
  }

  const byParent = new Map()
  for (const e of entries || []) if (e.parent_entry_id) byParent.set(e.parent_entry_id, [...(byParent.get(e.parent_entry_id) || []), e])
  const top = (entries || []).filter((e) => !e.parent_entry_id || !entries.some((p) => p.id === e.parent_entry_id))

  return (
    <section className="ds-section">
      <div className="ds-box-head">
        <h2>Everything in this dossier</h2>
        <div className="ds-seg" role="group" aria-label="Filter by kind">
          {FILTERS.map(([k, label]) => (
            <button key={k || 'all'} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      </div>
      <input id="search-dossier" className="ds-input ds-search" type="search" placeholder="Search titles and text…"
        value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search in this dossier" />
      {error && <p className="ds-error">{error}</p>}
      {!entries ? <p className="ds-muted">Loading…</p> : top.length === 0 ? (
        <div className="ds-empty">{q || kind ? 'Nothing matches this search.' : 'This dossier is still empty. Add files, text or a link above.'}</div>
      ) : (
        <ol className="ds-entries">
          {top.map((entry) => (
            <li key={entry.id} className={`ds-entry${entry.pinned ? ' is-pinned' : ''}`}>
              <div className="ds-entry-head">
                <span className={`ds-kind ds-kind-${entry.kind}`}>{KIND_LABELS[entry.kind]}</span>
                <button type="button" className="ds-entry-title" onClick={() => toggle(entry.id)} aria-expanded={open.has(entry.id)}>
                  {entry.title}
                </button>
                <span className="ds-muted ds-small">{formatDate(entry.occurred_at || entry.created_at)}</span>
              </div>
              {open.has(entry.id) && (
                <div className="ds-entry-body">
                  {entry.source_url && <p className="ds-small"><a href={entry.source_url} target="_blank" rel="noopener noreferrer">{entry.source_url}</a></p>}
                  <div className="ds-prose">{entry.body || <span className="ds-muted">No text.</span>}</div>
                  {(byParent.get(entry.id) || []).length > 0 && (
                    <ul className="ds-attachments">
                      {byParent.get(entry.id).map((att) => (
                        <li key={att.id}>
                          Attachment: <button type="button" className="ds-link" onClick={() => downloadEntry(att).catch((e) => setError(e.message))}>{att.original_filename}</button>
                          <span className="ds-muted ds-small"> {formatSize(att.size_bytes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="ds-entry-actions">
                {entry.has_file && <button type="button" className="ds-btn ds-btn-small" onClick={() => downloadEntry(entry).catch((e) => setError(e.message))}>Download{entry.size_bytes ? ` (${formatSize(entry.size_bytes)})` : ''}</button>}
                <button type="button" className="ds-btn ds-btn-small" onClick={() => togglePin(entry)}>{entry.pinned ? 'Unpin' : 'Pin'}</button>
                {confirmId === entry.id ? (
                  <>
                    <span className="ds-small">Delete for good?</span>
                    <button type="button" className="ds-btn ds-btn-small" onClick={() => setConfirmId(null)}>Keep</button>
                    <button type="button" className="ds-btn ds-btn-small ds-btn-danger" onClick={() => remove(entry)}>Delete</button>
                  </>
                ) : (
                  <button type="button" className="ds-btn ds-btn-small" onClick={() => setConfirmId(entry.id)}>Delete</button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
