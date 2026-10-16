import { useCallback, useEffect, useState } from 'react'
import { copyText } from '@components/CopyButton.jsx'
import { listDossiers, listOutbox, outboxToDossier, updateOutbox } from '../api.js'
import { formatDate } from '../format.js'

const VALUE = { high: 'High value', medium: 'Medium value', low: 'Low value' }
const URGENCY = { today: 'Today', week: 'This week', later: 'Later', none: 'No action' }
const ACTION = { reply: 'Reply', read: 'Read', forward: 'Forward', none: 'Nothing' }

// Mail zonder dossier die actie vraagt: ingeschat op waarde en urgentie, met conceptantwoord.
// Het concept kopieer je zelf naar Outlook; Claude verstuurt nooit iets.
export default function OutboxPage({ onChanged }) {
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState('open')
  const [dossiers, setDossiers] = useState([])
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [list, all] = await Promise.all([listOutbox(status), listDossiers()])
      setItems(list)
      setDossiers(all.filter((d) => d.status !== 'archived'))
      if (status === 'open') onChanged?.(list.length)
    } catch (e) { setError(e.message) }
  }, [status, onChanged])

  useEffect(() => { reload() }, [reload])

  async function act(fn) {
    try { await fn(); await reload() } catch (e) { setError(e.message) }
  }

  return (
    <div className="ds-page">
      <div className="ds-head">
        <h1>Outbox</h1>
        <div className="ds-seg" role="group" aria-label="Show">
          {[['open', 'Open'], ['done', 'Done'], ['dismissed', 'Dismissed']].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>
          ))}
        </div>
      </div>
      <p className="ds-muted ds-small">
        Mail that fits no dossier but needs action, filled during a mail round for all dossiers. Sorted by urgency, then value.
        Copy a draft into Outlook and send it yourself; Claude never sends mail.
      </p>
      {error && <p className="ds-error">{error}</p>}
      {!items ? <p className="ds-muted">Loading…</p> : items.length === 0 ? (
        <div className="ds-empty">{status === 'open' ? 'Nothing waiting. After a mail round for all dossiers, mail that needs action appears here.' : 'Nothing here.'}</div>
      ) : (
        <ol className="ds-entries">
          {items.map((item) => <OutboxItem key={item.id} item={item} dossiers={dossiers} act={act} />)}
        </ol>
      )}
    </div>
  )
}

function OutboxItem({ item, dossiers, act }) {
  const [draft, setDraft] = useState(item.draft_reply || '')
  const [copied, setCopied] = useState(false)
  const [target, setTarget] = useState('')

  async function copy() {
    try { await copyText(draft); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { setCopied(false) }
  }

  return (
    <li className={`ds-entry ds-outbox ds-urgency-${item.urgency}`}>
      <div className="ds-entry-head">
        <span className={`ds-chip ds-chip-${item.urgency}`}>{URGENCY[item.urgency]}</span>
        <span className="ds-chip">{VALUE[item.value]}</span>
        <strong className="ds-entry-title-static">{item.title}</strong>
        <span className="ds-muted ds-small">{item.sender_role ? `${item.sender_role} · ` : ''}{formatDate(item.received_at)}</span>
      </div>
      {item.summary && <p className="ds-prose">{item.summary}</p>}
      {item.reason && <p className="ds-reason">Why: {item.reason}</p>}
      <p className="ds-small"><strong>Suggested action:</strong> {ACTION[item.action]}</p>
      {item.action !== 'none' && (
        <div className="ds-edit">
          <textarea id={`draft-${item.id}`} className="ds-input" rows={5} value={draft} placeholder="No draft yet."
            onChange={(e) => setDraft(e.target.value)} aria-label="Draft reply" />
          <div className="ds-entry-actions">
            <button type="button" className="ds-btn ds-btn-small" onClick={copy} disabled={!draft}>{copied ? 'Copied' : 'Copy draft'}</button>
            {draft !== (item.draft_reply || '') && (
              <button type="button" className="ds-btn ds-btn-small" onClick={() => act(() => updateOutbox(item.id, { draft_reply: draft }))}>Save draft</button>
            )}
          </div>
        </div>
      )}
      <div className="ds-entry-actions">
        {item.status === 'open' ? (
          <>
            <button type="button" className="ds-btn ds-btn-small ds-btn-primary" onClick={() => act(() => updateOutbox(item.id, { status: 'done' }))}>Done</button>
            <button type="button" className="ds-btn ds-btn-small" onClick={() => act(() => updateOutbox(item.id, { status: 'dismissed' }))}>Dismiss</button>
            <select id={`to-${item.id}`} className="ds-input ds-move" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Move to dossier">
              <option value="">Belongs to a dossier…</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {target && <button type="button" className="ds-btn ds-btn-small" onClick={() => act(() => outboxToDossier(item.id, target))}>Move</button>}
          </>
        ) : (
          <button type="button" className="ds-btn ds-btn-small" onClick={() => act(() => updateOutbox(item.id, { status: 'open' }))}>Reopen</button>
        )}
      </div>
    </li>
  )
}
