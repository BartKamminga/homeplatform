import { useCallback, useEffect, useState } from 'react'
import { getInbox, listDossiers, reviewEntry, updateDossier, updateEntry } from '../api.js'
import { formatDate, mailTriagePrompt } from '../format.js'
import InstructionBox from '../components/InstructionBox.jsx'

// Alles wat op Bart wacht na een mailronde: voorgestelde dossiers en mailvoorstellen in alle dossiers.
export default function InboxPage({ onOpen, onChanged }) {
  const [inbox, setInbox] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [box, all] = await Promise.all([getInbox(), listDossiers()])
      setInbox(box)
      setDossiers(all.filter((d) => d.status !== 'archived'))
      onChanged?.(box.dossiers.length + box.entries.length)
    } catch (e) { setError(e.message) }
  }, [onChanged])

  useEffect(() => { reload() }, [reload])

  async function act(id, fn) {
    setBusy(id)
    try { await fn(); await reload() } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  if (error) return <div className="ds-page"><p className="ds-error">{error}</p></div>
  if (!inbox) return <div className="ds-page"><p className="ds-muted">Loading inbox…</p></div>

  const byDossier = new Map()
  for (const e of inbox.entries) byDossier.set(e.dossier_slug, [...(byDossier.get(e.dossier_slug) || []), e])
  const empty = inbox.dossiers.length === 0 && inbox.entries.length === 0

  return (
    <div className="ds-page">
      <div className="ds-head"><h1>Inbox</h1></div>
      <InstructionBox
        title="Mail round for all dossiers"
        text="Claude reads your inbox and sent mail in Claude Desktop (screenshot mode or built-in browser, read only), files mails into existing dossiers and suggests new dossiers for topics that have none. Everything lands here for you to review."
        instruction={(env) => mailTriagePrompt(env)}
      />

      {empty && <div className="ds-empty">Nothing to review. After a mail round, suggested dossiers and mails appear here.</div>}

      {inbox.dossiers.length > 0 && (
        <section className="ds-section">
          <h2>Suggested dossiers <span className="ds-badge">{inbox.dossiers.length}</span></h2>
          <div className="ds-cards">
            {inbox.dossiers.map((d) => (
              <div key={d.id} className="ds-card ds-card-static">
                <strong>{d.name}</strong>
                <span className="ds-card-summary">{d.summary || d.mail_criteria || 'Suggested by Claude in a mail round'}</span>
                <span className="ds-muted ds-small">{d.proposed_count} mails to review</span>
                <div className="ds-inline">
                  <button type="button" className="ds-btn" disabled={busy === d.id} onClick={() => act(d.id, () => updateDossier(d.id, { status: 'archived' }))}>Reject</button>
                  <button type="button" className="ds-btn ds-btn-primary" disabled={busy === d.id} onClick={() => act(d.id, () => updateDossier(d.id, { status: 'active' }))}>Accept dossier</button>
                  <button type="button" className="ds-link ds-small" onClick={() => onOpen(d.slug)}>Open</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {[...byDossier.entries()].map(([slug, entries]) => (
        <section key={slug} className="ds-box ds-proposals">
          <div className="ds-box-head">
            <h2>{entries[0].dossier_name} <span className="ds-badge">{entries.length}</span></h2>
            <div className="ds-inline">
              <button type="button" className="ds-btn" onClick={() => act(slug, async () => { for (const e of entries) await reviewEntry(e.id, 'reject') })}>Reject all</button>
              <button type="button" className="ds-btn ds-btn-primary" onClick={() => act(slug, async () => { for (const e of entries) await reviewEntry(e.id, 'accept') })}>Accept all</button>
            </div>
          </div>
          <ul className="ds-proposal-list">
            {entries.map((p) => (
              <li key={p.id} className="ds-proposal">
                <div className="ds-proposal-main">
                  <strong>{p.title}</strong>
                  {p.occurred_at && <span className="ds-muted ds-small"> · {formatDate(p.occurred_at)}</span>}
                  {p.reason && <p className="ds-reason">Why: {p.reason}</p>}
                  {p.body && <p className="ds-prose ds-small">{p.body}</p>}
                </div>
                <div className="ds-proposal-actions">
                  <select id={`move-${p.id}`} className="ds-input ds-move" value={p.dossier_id} aria-label="Move to dossier"
                    onChange={(e) => act(p.id, () => updateEntry(p.id, { dossier_id: e.target.value }))}>
                    {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.status === 'proposed' ? ' (suggested)' : ''}</option>)}
                  </select>
                  <button type="button" className="ds-btn" disabled={busy === p.id} onClick={() => act(p.id, () => reviewEntry(p.id, 'reject'))}>Reject</button>
                  <button type="button" className="ds-btn ds-btn-primary" disabled={busy === p.id} onClick={() => act(p.id, () => reviewEntry(p.id, 'accept'))}>Accept</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
