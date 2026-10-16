import { useEffect, useState } from 'react'
import { createDossier, listDossiers, searchAll } from '../api.js'
import { formatDate, KIND_LABELS } from '../format.js'

export default function DossierListPage({ onOpen }) {
  const [dossiers, setDossiers] = useState(null)
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { listDossiers().then(setDossiers).catch((e) => setError(e.message)) }, [])

  useEffect(() => {
    if (query.trim().length < 2) { setHits(null); return }
    const t = setTimeout(() => searchAll(query.trim()).then(setHits).catch((e) => setError(e.message)), 300)
    return () => clearTimeout(t)
  }, [query])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const dossier = await createDossier(name.trim())
      onOpen(dossier.slug)
    } catch (err) { setError(err.message) }
  }

  // Voorgestelde dossiers (uit een mailronde) staan in de Inbox, niet hier.
  const active = (dossiers || []).filter((d) => d.status === 'active')
  const archived = (dossiers || []).filter((d) => d.status === 'archived')

  return (
    <div className="ds-page">
      <div className="ds-head">
        <h1>Dossiers</h1>
        <form className="ds-inline" onSubmit={handleCreate}>
          <input id="new-dossier" className="ds-input" placeholder="New dossier name" value={name}
            onChange={(e) => setName(e.target.value)} aria-label="New dossier name" />
          <button className="ds-btn ds-btn-primary" type="submit" disabled={!name.trim()}>New dossier</button>
        </form>
      </div>

      <input id="search-all" className="ds-input ds-search" type="search" placeholder="Search in all dossiers…"
        value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search in all dossiers" />
      {error && <p className="ds-error">{error}</p>}

      {hits ? (
        <section className="ds-section">
          <h2>{hits.length} results for “{query.trim()}”</h2>
          <ul className="ds-hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" className="ds-link" onClick={() => onOpen(h.dossier_slug)}>{h.title}</button>
                <span className="ds-muted"> · {KIND_LABELS[h.kind]} · {h.dossier_name} · {formatDate(h.occurred_at || h.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : !dossiers ? (
        <p className="ds-muted">Loading dossiers…</p>
      ) : active.length === 0 && archived.length === 0 ? (
        <div className="ds-empty">No dossiers yet. Give your first one a name above, for example “LCMS future”.</div>
      ) : (
        <>
          <div className="ds-cards">{active.map((d) => <DossierCard key={d.id} dossier={d} onOpen={onOpen} />)}</div>
          {archived.length > 0 && (
            <section className="ds-section">
              <h2>Archived</h2>
              <div className="ds-cards">{archived.map((d) => <DossierCard key={d.id} dossier={d} onOpen={onOpen} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function DossierCard({ dossier, onOpen }) {
  const firstLine = (dossier.summary || '').split('\n').find((l) => l.trim()) || 'No summary yet'
  return (
    <button type="button" className="ds-card" onClick={() => onOpen(dossier.slug)}>
      <strong>{dossier.name}</strong>
      <span className="ds-card-summary">{firstLine.replace(/^#+\s*/, '')}</span>
      <span className="ds-muted ds-small">
        {dossier.entry_count} items · updated {formatDate(dossier.updated_at)}
        {dossier.proposed_count > 0 && <span className="ds-badge">{dossier.proposed_count} to review</span>}
      </span>
    </button>
  )
}
