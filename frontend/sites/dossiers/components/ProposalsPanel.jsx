import { useState } from 'react'
import { reviewEntry } from '../api.js'
import { formatDate } from '../format.js'

// Mailvoorstellen die Claude in Claude Desktop (ingebouwde browser) heeft gevonden.
export default function ProposalsPanel({ proposals, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function decide(entry, decision) {
    setBusyId(entry.id)
    try {
      await reviewEntry(entry.id, decision)
      onChanged()
    } catch (e) { setError(e.message) } finally { setBusyId(null) }
  }

  async function decideAll(decision) {
    for (const entry of proposals) {
      // eslint-disable-next-line no-await-in-loop -- bewust één voor één
      await reviewEntry(entry.id, decision).catch((e) => setError(e.message))
    }
    onChanged()
  }

  return (
    <section className="ds-box ds-proposals">
      <div className="ds-box-head">
        <h2>Proposed mails <span className="ds-badge">{proposals.length}</span></h2>
        <div className="ds-inline">
          <button type="button" className="ds-btn" onClick={() => decideAll('reject')}>Reject all</button>
          <button type="button" className="ds-btn ds-btn-primary" onClick={() => decideAll('accept')}>Accept all</button>
        </div>
      </div>
      <p className="ds-muted ds-small">Found by Claude in Outlook Web. Accepted mails become part of the dossier; rejected ones are remembered so they are not proposed again.</p>
      <ul className="ds-proposal-list">
        {proposals.map((p) => (
          <li key={p.id} className="ds-proposal">
            <div className="ds-proposal-main">
              <strong>{p.title}</strong>
              <span className="ds-muted ds-small"> · {formatDate(p.occurred_at)}</span>
              {p.reason && <p className="ds-reason">Why: {p.reason}</p>}
              {p.body && <p className="ds-prose ds-small">{p.body}</p>}
              {p.source_url && <a className="ds-small" href={p.source_url} target="_blank" rel="noopener noreferrer">Open in Outlook</a>}
            </div>
            <div className="ds-proposal-actions">
              <button type="button" className="ds-btn" disabled={busyId === p.id} onClick={() => decide(p, 'reject')}>Reject</button>
              <button type="button" className="ds-btn ds-btn-primary" disabled={busyId === p.id} onClick={() => decide(p, 'accept')}>Accept</button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="ds-error">{error}</p>}
    </section>
  )
}
