import { useState } from 'react'
import { copyText } from '@components/CopyButton.jsx'
import { updateDossier } from '../api.js'
import { formatDate, mailRoundPrompt } from '../format.js'

export default function SummaryPanel({ dossier, onSaved }) {
  const [editing, setEditing] = useState(null) // 'summary' | 'mail_criteria' | 'name' | null
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  function startEdit(field) {
    setDraft(dossier[field] || '')
    setEditing(field)
  }

  async function save() {
    try {
      onSaved(await updateDossier(dossier.id, { [editing]: draft }))
      setEditing(null)
    } catch (e) { setError(e.message) }
  }

  async function toggleArchive() {
    try {
      onSaved(await updateDossier(dossier.id, { status: dossier.status === 'active' ? 'archived' : 'active' }))
    } catch (e) { setError(e.message) }
  }

  async function copyPrompt() {
    try {
      await copyText(mailRoundPrompt(dossier))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { setError('Copying failed. Select the text in the mail criteria and copy it yourself.') }
  }

  const editor = (rows, placeholder) => (
    <div className="ds-edit">
      <textarea id={`edit-${editing}`} className="ds-input" rows={rows} value={draft} placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)} aria-label={`Edit ${editing}`} autoFocus />
      <div className="ds-actions">
        <button type="button" className="ds-btn" onClick={() => setEditing(null)}>Cancel</button>
        <button type="button" className="ds-btn ds-btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  )

  return (
    <section className="ds-summary">
      <div className="ds-head">
        {editing === 'name' ? editor(1) : (
          <h1>{dossier.name} <button type="button" className="ds-icon-btn" onClick={() => startEdit('name')} aria-label="Rename dossier">✎</button></h1>
        )}
        <div className="ds-inline">
          <span className="ds-muted ds-small">{dossier.entry_count} items · updated {formatDate(dossier.updated_at)}</span>
          <button type="button" className="ds-btn" onClick={toggleArchive}>{dossier.status === 'active' ? 'Archive' : 'Reactivate'}</button>
        </div>
      </div>

      <div className="ds-two">
        <div className="ds-box">
          <div className="ds-box-head">
            <h2>Where things stand</h2>
            {editing !== 'summary' && <button type="button" className="ds-btn" onClick={() => startEdit('summary')}>Edit</button>}
          </div>
          {editing === 'summary'
            ? editor(10, 'The current state of this question: conclusions, open points, next steps.')
            : <div className="ds-prose">{dossier.summary || <span className="ds-muted">No summary yet. Write down where things stand, or let Claude do it at the end of a session.</span>}</div>}
        </div>

        <div className="ds-box">
          <div className="ds-box-head">
            <h2>Mail round</h2>
            {editing !== 'mail_criteria' && <button type="button" className="ds-btn" onClick={() => startEdit('mail_criteria')}>Edit criteria</button>}
          </div>
          {editing === 'mail_criteria'
            ? editor(6, 'Search terms, senders or organisations, folders, period. For example: LCMS, LVCb, hosting migration, since September 2026.')
            : <div className="ds-prose">{dossier.mail_criteria || <span className="ds-muted">No criteria yet. Claude uses them to search Outlook Web for relevant mail.</span>}</div>}
          <p className="ds-muted ds-small">
            In Claude Desktop, open a session with the built-in browser and paste the instruction. Claude searches Outlook Web
            (read only) and puts relevant mails here as proposals for you to accept or reject.
          </p>
          <button type="button" className="ds-btn ds-btn-primary" onClick={copyPrompt} disabled={!dossier.mail_criteria}>
            {copied ? 'Copied, paste it in Claude Desktop' : 'Start mail round'}
          </button>
        </div>
      </div>
      {error && <p className="ds-error">{error}</p>}
    </section>
  )
}
