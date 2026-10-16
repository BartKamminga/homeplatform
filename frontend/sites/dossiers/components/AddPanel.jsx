import { useRef, useState } from 'react'
import { addEntry, uploadFiles } from '../api.js'

const ACCEPT = '.msg,.eml,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg'

export default function AddPanel({ dossier, onAdded }) {
  const [mode, setMode] = useState('files') // files | text | link
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('note')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const fileInput = useRef(null)

  async function sendFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setBusy(true)
    setStatus(`Adding ${files.length} file${files.length > 1 ? 's' : ''}…`)
    try {
      const results = await uploadFiles(dossier.id, files)
      const failed = results.filter((r) => r.error)
      const skipped = results.filter((r) => r.created === false)
      const parts = [`${results.length - failed.length - skipped.length} added`]
      if (skipped.length) parts.push(`${skipped.length} already in this dossier`)
      if (failed.length) parts.push(`not added: ${failed.map((f) => `${f.original_filename} (${f.error})`).join(', ')}`)
      setStatus(parts.join(' · '))
      onAdded()
    } catch (e) { setStatus(e.message) } finally { setBusy(false) }
  }

  async function sendText(e) {
    e.preventDefault()
    const firstLine = body.split('\n').find((l) => l.trim()) || ''
    const entryTitle = (title || firstLine).trim().slice(0, 140)
    if (!entryTitle) return
    setBusy(true)
    try {
      await addEntry(dossier.id, { kind, title: entryTitle, body: body || null })
      setTitle(''); setBody(''); setStatus('Added.')
      onAdded()
    } catch (err) { setStatus(err.message) } finally { setBusy(false) }
  }

  async function sendLink(e) {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    try {
      await addEntry(dossier.id, { kind: 'link', title: (title || url).trim(), source_url: url.trim(), body: body || null })
      setUrl(''); setTitle(''); setBody(''); setStatus('Link added.')
      onAdded()
    } catch (err) { setStatus(err.message) } finally { setBusy(false) }
  }

  return (
    <section className="ds-box ds-add">
      <div className="ds-box-head">
        <h2>Add to dossier</h2>
        <div className="ds-seg" role="group" aria-label="What to add">
          {[['files', 'Files'], ['text', 'Text'], ['link', 'Link']].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
      </div>

      {mode === 'files' && (
        <div
          className={`ds-drop${dragging ? ' is-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); sendFiles(e.dataTransfer.files) }}
        >
          <p><strong>Drop mails and documents here</strong></p>
          <p className="ds-muted ds-small">.msg and .eml (with attachments), PDF, Word, text and images. Text is extracted automatically, so it is searchable and available to Claude.</p>
          <button type="button" className="ds-btn" onClick={() => fileInput.current?.click()} disabled={busy}>Choose files</button>
          <input ref={fileInput} id="file-input" type="file" multiple accept={ACCEPT} hidden
            onChange={(e) => { sendFiles(e.target.files); e.target.value = '' }} />
        </div>
      )}

      {mode === 'text' && (
        <form className="ds-form" onSubmit={sendText}>
          <div className="ds-row">
            <select id="text-kind" className="ds-input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
              <option value="note">Note</option>
              <option value="idea">Idea</option>
              <option value="mail">Mail (pasted)</option>
              <option value="session">Session note</option>
            </select>
            <input id="text-title" className="ds-input" placeholder="Title (optional, otherwise the first line)" value={title}
              onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          </div>
          <textarea id="text-body" className="ds-input" rows={6} placeholder="Paste or type text: a note, a summary of a mail, an idea…"
            value={body} onChange={(e) => setBody(e.target.value)} aria-label="Text" />
          <div className="ds-actions"><button className="ds-btn ds-btn-primary" type="submit" disabled={busy || !(title || body).trim()}>Add</button></div>
        </form>
      )}

      {mode === 'link' && (
        <form className="ds-form" onSubmit={sendLink}>
          <div className="ds-row">
            <input id="link-url" className="ds-input" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL" />
            <input id="link-title" className="ds-input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          </div>
          <textarea id="link-body" className="ds-input" rows={3} placeholder="Why it matters (optional)" value={body}
            onChange={(e) => setBody(e.target.value)} aria-label="Why it matters" />
          <div className="ds-actions"><button className="ds-btn ds-btn-primary" type="submit" disabled={busy || !url.trim()}>Add link</button></div>
        </form>
      )}

      <p className="ds-hint">No confidential originals: summaries and public sources only.</p>
      {status && <p className="ds-status" aria-live="polite">{status}</p>}
    </section>
  )
}
