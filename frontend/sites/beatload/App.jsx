import { useState, useEffect, useRef } from 'react'
import { submitDownload, listJobs, deleteJob } from './api.js'
import './App.css'

const SOURCE_ICON  = { beatport: '🎵', youtube: '▶️', soundcloud: '☁️', auto: '🌐' }
const STATUS_ICON  = { queued: '🕐', downloading: '⏳', done: '✅', error: '❌' }
const STATUS_LABEL = { queued: 'Wachtrij', downloading: 'Bezig…', done: 'Klaar', error: 'Fout' }

function trimUrl(url, max = 60) {
  try {
    const u = new URL(url)
    const path = u.hostname + u.pathname
    return path.length > max ? '…' + path.slice(-(max - 1)) : path
  } catch {
    return url.length > max ? url.slice(0, max) + '…' : url
  }
}

export default function App() {
  const [url, setUrl]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [jobs, setJobs]         = useState([])
  const [submitError, setSubmitError] = useState('')
  const timerRef = useRef(null)

  const load = () => listJobs().then(setJobs).catch(() => {})

  useEffect(() => { load() }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'downloading')
    if (hasActive) {
      const interval = jobs.some(j => j.status === 'downloading') ? 2000 : 3000
      timerRef.current = setInterval(load, interval)
    }
    return () => clearInterval(timerRef.current)
  }, [jobs])

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitDownload({ url: trimmed })
      setUrl('')
      await load()
    } catch (err) {
      setSubmitError(err.message || 'Toevoegen mislukt')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id) => {
    try {
      await deleteJob(id)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch {}
  }

  const queued      = jobs.filter(j => j.status === 'queued')
  const downloading = jobs.filter(j => j.status === 'downloading')
  const done        = jobs.filter(j => j.status === 'done')
  const failed      = jobs.filter(j => j.status === 'error')

  return (
    <div className="bl-wrap">
      <header className="bl-header">
        <h1>🎵 Beatload</h1>
        <p>Download tracks van Beatport, YouTube en meer als FLAC</p>
      </header>

      <form className="bl-form" onSubmit={submit}>
        <input
          className="bl-input"
          type="text"
          placeholder="Beatport-URL, YouTube-link of andere bron…"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={submitting}
          autoFocus
        />
        <button className="bl-btn" type="submit" disabled={submitting || !url.trim()}>
          {submitting ? '…' : 'Download'}
        </button>
      </form>

      {submitError && <div className="bl-error-msg">{submitError}</div>}

      {jobs.length === 0 && (
        <div className="bl-empty">
          <span>Nog geen downloads. Plak een URL hierboven.</span>
        </div>
      )}

      {downloading.length > 0 && (
        <section className="bl-section">
          <h2 className="bl-section-title">Bezig</h2>
          {downloading.map(job => <JobRow key={job.id} job={job} onDelete={remove} />)}
        </section>
      )}

      {queued.length > 0 && (
        <section className="bl-section">
          <h2 className="bl-section-title">Wachtrij ({queued.length})</h2>
          {queued.map(job => <JobRow key={job.id} job={job} onDelete={remove} />)}
        </section>
      )}

      {done.length > 0 && (
        <section className="bl-section">
          <h2 className="bl-section-title">Klaar ({done.length})</h2>
          {done.map(job => <JobRow key={job.id} job={job} onDelete={remove} />)}
        </section>
      )}

      {failed.length > 0 && (
        <section className="bl-section">
          <h2 className="bl-section-title">Mislukt ({failed.length})</h2>
          {failed.map(job => <JobRow key={job.id} job={job} onDelete={remove} />)}
        </section>
      )}
    </div>
  )
}

function JobRow({ job, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const logRef = useRef(null)
  const canDelete = job.status === 'done' || job.status === 'error'

  const progressLines = job.progress_log ? job.progress_log.split('\n').filter(Boolean) : []
  const lastLine = progressLines.at(-1) || ''

  useEffect(() => {
    if (expanded && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [expanded, job.progress_log])

  return (
    <div className={`bl-job bl-job--${job.status}`}>
      <span className="bl-job-icon">{STATUS_ICON[job.status]}</span>

      <div className="bl-job-body" onClick={() => setExpanded(e => !e)} role="button" tabIndex={0}>
        <div className="bl-job-url">{trimUrl(job.url)}</div>
        {job.output_path && <div className="bl-job-file">{job.output_path}</div>}

        {/* Collapsed: last progress line */}
        {!expanded && job.status === 'downloading' && lastLine && (
          <div className="bl-job-progress-hint">{lastLine}</div>
        )}

        {/* Expanded: full log */}
        {expanded && progressLines.length > 0 && (
          <pre className="bl-job-progress-log" ref={logRef}>{progressLines.join('\n')}</pre>
        )}

        {expanded && job.error && <pre className="bl-job-err">{job.error}</pre>}
        {!expanded && job.error && (
          <div className="bl-job-err-hint">⚠ {job.error.slice(0, 120)}{job.error.length > 120 ? '…' : ''}</div>
        )}
      </div>

      <div className="bl-job-meta">
        <span className={`bl-badge bl-badge--${job.status}`}>{STATUS_LABEL[job.status]}</span>
        <span className="bl-source">{SOURCE_ICON[job.source] || '🌐'}</span>
        {canDelete && (
          <button className="bl-del" title="Verwijderen" onClick={() => onDelete(job.id)}>✕</button>
        )}
      </div>
    </div>
  )
}
