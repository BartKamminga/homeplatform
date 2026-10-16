import { useEffect, useState } from 'react'
import { listEntries } from '../api.js'
import { formatDate } from '../format.js'
import PageViewer from './PageViewer.jsx'

// Uitwerkingen (HTML-pagina's) en ideeën van een dossier, bovenaan en in één oogopslag.
export default function OutputsPanel({ dossier, version }) {
  const [pages, setPages] = useState([])
  const [ideas, setIdeas] = useState([])
  const [open, setOpen] = useState(null)

  useEffect(() => {
    listEntries(dossier.id, { kind: 'page' }).then(setPages).catch(() => {})
    listEntries(dossier.id, { kind: 'idea' }).then(setIdeas).catch(() => {})
  }, [dossier.id, version])

  if (pages.length === 0 && ideas.length === 0) return null

  return (
    <section className="ds-section">
      {pages.length > 0 && (
        <>
          <h2>Pages</h2>
          <div className="ds-cards">
            {pages.map((p) => (
              <button key={p.id} type="button" className="ds-card ds-page-card" onClick={() => setOpen(p)}>
                <strong>{p.title}</strong>
                <span className="ds-card-summary">{(p.body || '').slice(0, 160)}</span>
                <span className="ds-muted ds-small">Updated {formatDate(p.updated_at)} · open</span>
              </button>
            ))}
          </div>
        </>
      )}
      {ideas.length > 0 && (
        <div className="ds-box">
          <h2>Ideas</h2>
          <ul className="ds-ideas">
            {ideas.map((i) => (
              <li key={i.id}><strong>{i.title}</strong>{i.body && <span className="ds-muted"> — {i.body}</span>}</li>
            ))}
          </ul>
        </div>
      )}
      {open && <PageViewer entry={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
