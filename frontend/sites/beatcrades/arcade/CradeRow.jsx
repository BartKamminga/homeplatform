import { useState, useEffect, useRef } from 'react'
import { updateCrade, getCradeDiskInfo } from '../api.js'
import { STALL_MS, FMT_LABEL, detectSrc, parseProgress, lastLine, parseCurrentTrack, utcDate, fmtBytes } from '../helpers.js'
import { AcLeds } from '@components/arcade/controls.jsx'

// Crade-rij in arcade-stijl (item 1338), zelfde gedrag als classic CradeRow.
const STATUS = {
  no_job: ['empty', 'EMPTY'], queued: ['queued', 'QUEUED'], downloading: ['busy', 'BUSY'], done: ['done', 'DONE'], error: ['error', 'ERROR'],
}
const SRC = { beatport: 'BP', youtube: 'YT', soundcloud: 'SC', auto: 'WEB' }

export default function CradeRow({ crade, open, onToggle, onRename, onDelete, onRestart, onCancel, dragProps, dragging }) {
  const [logOpen, setLogOpen] = useState(false)
  const [notes, setNotes] = useState(crade.notes || '')
  const [disk, setDisk] = useState(null)
  const saveTimer = useRef(null)

  const src = detectSrc(crade.source_url)
  const { done, total } = parseProgress(crade.progress_log)
  const current = parseCurrentTrack(crade.progress_log)
  const lp = utcDate(crade.last_progress_at)
  const stalled = crade.status === 'downloading' && lp && (Date.now() - lp.getTime()) > (STALL_MS[src] ?? STALL_MS.auto)
  const [cls, label] = stalled ? ['error', 'STALLED'] : (STATUS[crade.status] || STATUS.no_job)
  const canCancel = crade.status === 'downloading'
  const canRestart = ['error', 'done', 'no_job'].includes(crade.status) || stalled
  const fmt = FMT_LABEL[crade.format] || crade.format?.toUpperCase()
  const mismatch = crade.actual_format && crade.actual_format !== crade.format

  useEffect(() => { setNotes(crade.notes || '') }, [crade.notes])
  useEffect(() => {
    if (open && crade.status === 'done') getCradeDiskInfo(crade.id).then(setDisk).catch(() => {})
  }, [open, crade.id, crade.status])

  function onNotes(e) {
    const v = e.target.value
    setNotes(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => updateCrade(crade.id, { notes: v }).catch(() => {}), 800)
  }

  const count = total ? `${done}/${total}` : done > 0 ? `${done}` : crade.track_count ? `${crade.track_count}` : null
  const stop = fn => e => { e.stopPropagation(); fn() }

  return (
    <div className={`bca-crade s-${cls}${open ? ' open' : ''}${dragging ? ' dragging' : ''}`}>
      <div className="bca-crade-row" onClick={onToggle}>
        <span className="bca-drag" title="Drag to a rack" {...dragProps} onClick={e => e.stopPropagation()}>⠿</span>
        <span className="bca-chev">{open ? '▾' : '▸'}</span>
        <div className="bca-name">
          <button type="button" className="bca-title" onClick={stop(onRename)} title="Rename">{crade.name}</button>
          {crade.artist && <small>{crade.artist}</small>}
          {crade.status === 'downloading' && (
            <div className="bca-prog">
              {total ? <AcLeds n={24} on={Math.round(done / total * 24)} /> : null}
              <span>{current ? `♪ ${current}` : (lastLine(crade.progress_log) || 'Download started…')}</span>
            </div>
          )}
        </div>
        <div className="bca-badges">
          {crade.item_type && <span className="ac-pill tag">{crade.item_type.toUpperCase()}</span>}
          <span className="ac-pill fmt">{SRC[src]}</span>
          {count && <span className="ac-pill fmt">{count} TRACKS</span>}
          <span className={`ac-pill ${cls}`}>{label}</span>
          {mismatch
            ? <span className="ac-pill warn" title={`Requested ${fmt}`}>{crade.actual_format.toUpperCase()} ⚠</span>
            : <span className="ac-pill fmt">{fmt}</span>}
        </div>
        <div className="bca-actions">
          {canCancel && <button type="button" className="ac-icon" onClick={stop(onCancel)} aria-label="Stop download" title="Stop">■</button>}
          {canRestart && (
            <button type="button" className="ac-icon" onClick={stop(onRestart)} style={crade.status === 'no_job' ? { color: 'var(--ac-ok)' } : undefined}
              aria-label={crade.status === 'no_job' ? 'Start download' : 'Restart'} title={crade.status === 'no_job' ? 'Start' : 'Restart'}>
              {crade.status === 'no_job' ? '▶' : '↺'}
            </button>
          )}
          <button type="button" className="ac-icon danger" onClick={stop(onDelete)} aria-label="Delete" title="Delete">✕</button>
        </div>
      </div>

      {open && (
        <div className="bca-detail">
          <div className="bca-detail-col">
            {crade.source_url && <div><span className="ac-label">Source</span><div className="ac-well">{crade.source_url}</div></div>}
            {(crade.subdir || crade.output_path) && (
              <div><span className="ac-label">Folder</span><div className="ac-well">{crade.output_path || `downloads/${crade.subdir}/`}</div></div>
            )}
            <div>
              <label className="ac-label" htmlFor={`notes-${crade.id}`}>Notes</label>
              <textarea id={`notes-${crade.id}`} className="ac-input" rows={2} value={notes} onChange={onNotes} placeholder="Notes…" />
            </div>
          </div>
          <div className="bca-detail-col">
            {crade.status === 'done' && (
              <div className="ac-grid">
                <div><small>FILES</small><b>{disk ? (disk.available ? disk.file_count : '–') : '…'}</b><i>{disk && !disk.available ? 'folder not found' : 'on disk'}</i></div>
                <div><small>SIZE</small><b>{disk?.available ? fmtBytes(disk.total_bytes) : '…'}</b><i>{fmt}</i></div>
              </div>
            )}
            {crade.status === 'downloading' && total > 0 && (
              <div className="ac-grid"><div><small>PROGRESS</small><b>{Math.round(done / total * 100)}%</b><i>{done} / {total}</i></div></div>
            )}
            {crade.error && <div className="ac-well" style={{ color: 'var(--ac-pink)' }}>{crade.error}</div>}
            {crade.progress_log && (
              <div>
                <span className="ac-label">Log · click to {logOpen ? 'collapse' : 'expand'}</span>
                <div className={`ac-well bca-log${logOpen ? ' full' : ''}`} onClick={() => setLogOpen(o => !o)}>
                  {logOpen ? crade.progress_log : lastLine(crade.progress_log)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
