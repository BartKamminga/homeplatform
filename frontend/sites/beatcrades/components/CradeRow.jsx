import { useState, useEffect, useRef, useCallback } from 'react'
import { CradeIcon } from './Icons.jsx'
import { updateCrade, getCradeDiskInfo } from '../api.js'
import {
  ST, SRC_ICON, STALL_MS,
  detectSrc, parseProgress, lastLine, parseCurrentTrack, utcDate, fmtBytes,
} from '../helpers.js'

export function CradeRow({
  crade, open, onToggle, onRename, onDelete, onRestart, onCancel,
  inRack, dragging, onDragStart, onDragEnd,
  allRacks, onMove,
}) {
  const [logExpanded, setLogExpanded] = useState(false)
  const [notes,       setNotes]       = useState(crade.notes || '')
  const [moveOpen,    setMoveOpen]    = useState(false)
  const [diskInfo,    setDiskInfo]    = useState(null)
  const [diskLoading, setDiskLoading] = useState(false)
  const logRef  = useRef(null)
  const moveRef = useRef(null)
  const saveTimer = useRef(null)

  const st  = ST[crade.status] || ST.no_job
  const src = detectSrc(crade.source_url)
  const { done, total } = parseProgress(crade.progress_log)
  const pct = total ? Math.round(done / total * 100) : 0
  const isActive = crade.status === 'downloading' || crade.status === 'queued'
  const currentTrack = parseCurrentTrack(crade.progress_log)

  const lpAt    = utcDate(crade.last_progress_at)
  const stallMs = STALL_MS[src] ?? STALL_MS.auto
  const isStalled = crade.status === 'downloading' && lpAt && (Date.now() - lpAt.getTime()) > stallMs

  const canCancel  = crade.status === 'downloading'
  const canRestart = crade.status === 'error' || crade.status === 'done' || isStalled || crade.status === 'no_job'

  useEffect(() => {
    if (logExpanded && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logExpanded, crade.progress_log])

  // Sync notes when crade prop updates externally
  useEffect(() => { setNotes(crade.notes || '') }, [crade.notes])

  // Load disk info when done crade is expanded
  useEffect(() => {
    if (open && crade.status === 'done') {
      setDiskLoading(true)
      getCradeDiskInfo(crade.id).then(setDiskInfo).catch(() => {}).finally(() => setDiskLoading(false))
    }
  }, [open, crade.id, crade.status])

  // Close move popover on outside click
  useEffect(() => {
    if (!moveOpen) return
    const handler = e => { if (moveRef.current && !moveRef.current.contains(e.target)) setMoveOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moveOpen])

  // Debounced notes save
  const handleNotesChange = useCallback(e => {
    const val = e.target.value
    setNotes(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateCrade(crade.id, { notes: val }).catch(() => {})
    }, 800)
  }, [crade.id])

  const handleMove = rackId => {
    setMoveOpen(false)
    onMove?.(crade.id, rackId)
  }

  return (
    <div className={`bc-crade bc-crade--${st.cls}${open ? ' open' : ''}${inRack ? ' in-rack' : ''}${dragging ? ' dragging' : ''}`}
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>

      <div className="bc-crade-head" onClick={onToggle}>
        <span className="bc-drag" onClick={e => e.stopPropagation()} title="Crade slepen naar Rack">⠿</span>
        <span className="bc-chev">{open ? '▾' : '▸'}</span>
        <span className="bc-crade-icon"><CradeIcon size={16} /></span>
        <div className="bc-crade-name-wrap">
          <span className="bc-crade-name"
            onClick={e => { e.stopPropagation(); onRename() }}
            title="Klik om te hernoemen">
            {crade.name}
          </span>
          {crade.artist && (
            <span className="bc-crade-artist">{crade.artist}</span>
          )}
          {crade.status === 'downloading' && (
            <div className="bc-crade-progress-wrap">
              {currentTrack && <span className="bc-crade-current-track">♪ {currentTrack}</span>}
              <span className="bc-crade-progress-line">
                {crade.progress_log ? lastLine(crade.progress_log) : 'Downloaden gestart…'}
              </span>
            </div>
          )}
        </div>
        <div className="bc-badges">
          {crade.item_type && <span className="bc-badge bc-badge-type">{crade.item_type}</span>}
          <span className="bc-badge bc-badge-src">{SRC_ICON[src]}</span>
          {total ? (
            <span className="bc-badge bc-badge-cnt">{done}/{total} tracks</span>
          ) : done > 0 ? (
            <span className="bc-badge bc-badge-cnt">{done} track{done !== 1 ? 's' : ''}</span>
          ) : crade.track_count ? (
            <span className="bc-badge bc-badge-cnt">{crade.track_count} tracks</span>
          ) : null}
          {isStalled
            ? <span className="bc-badge bc-badge-st bc-badge-st--stalled">Vastgelopen</span>
            : <span className={`bc-badge bc-badge-st bc-badge-st--${st.cls}`}>{st.label}</span>
          }
          {crade.actual_format && crade.actual_format !== crade.format ? (
            <span className="bc-badge bc-badge-fmt bc-badge-fmt--mismatch" title={`Aangevraagd: ${crade.format.toUpperCase()}`}>
              {crade.actual_format.toUpperCase()} ⚠
            </span>
          ) : (
            <span className="bc-badge bc-badge-fmt">{crade.format.toUpperCase()}</span>
          )}
        </div>
        {allRacks && (
          <div className="bc-move-wrap" ref={moveRef} onClick={e => e.stopPropagation()}>
            <button className="bc-move-btn" onClick={() => setMoveOpen(o => !o)} title="Verplaatsen naar rack">↗</button>
            {moveOpen && (
              <div className="bc-move-pop">
                <div className="bc-move-pop-hdr">Verplaatsen naar</div>
                <button className={`bc-move-opt${!crade.group_id ? ' active' : ''}`} onClick={() => handleMove(null)}>
                  — geen rack —
                </button>
                {allRacks.map(r => (
                  <button key={r.id} className={`bc-move-opt${crade.group_id === r.id ? ' active' : ''}`} onClick={() => handleMove(r.id)}>
                    {r.sectionName ? `${r.sectionName} / ${r.name}` : r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canCancel && (
          <button className="bc-stop-btn" onClick={e => { e.stopPropagation(); onCancel() }} title="Download stoppen">⏹</button>
        )}
        {canRestart && (
          <button className="bc-restart-btn" onClick={e => { e.stopPropagation(); onRestart() }}
            title={crade.status === 'no_job' ? 'Download starten' : 'Opnieuw starten'}>
            {crade.status === 'no_job' ? '▶' : '↺'}
          </button>
        )}
        <button className="bc-del-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Verwijderen">✕</button>
      </div>

      {open && (
        <div className="bc-crade-body">
          {crade.source_url && (
            <div className="bc-src-url">{crade.source_url}</div>
          )}
          {crade.subdir && (
            <div className="bc-subdir"><CradeIcon size={13} /> downloads/{crade.subdir}/</div>
          )}
          {src === 'beatport' && crade.output_path && (
            <div className="bc-detected-name">📁 {crade.output_path}</div>
          )}

          {isActive && total > 0 && (
            <div className="bc-prog">
              <div className="bc-prog-bar"><div className="bc-prog-fill" style={{ width: `${pct}%` }} /></div>
              <span className="bc-prog-lbl">{done} / {total} ({pct}%)</span>
            </div>
          )}

          {crade.progress_log && (
            <div className="bc-log">
              {!logExpanded ? (
                <div className="bc-log-hint" onClick={() => setLogExpanded(true)} title="Klik voor volledig log">
                  {lastLine(crade.progress_log)}
                </div>
              ) : (
                <pre className="bc-log-full" ref={logRef} onClick={() => setLogExpanded(false)}>
                  {crade.progress_log}
                </pre>
              )}
            </div>
          )}

          {crade.error && (
            <div className="bc-crade-err">{crade.error}</div>
          )}

          {crade.status === 'done' && (
            <div className="bc-disk-row">
              {diskLoading
                ? 'Schijfinfo laden…'
                : diskInfo
                  ? diskInfo.available
                    ? `${diskInfo.file_count} bestand${diskInfo.file_count !== 1 ? 'en' : ''} · ${fmtBytes(diskInfo.total_bytes)}`
                    : 'Map niet gevonden op schijf'
                  : null}
            </div>
          )}

          <div className="bc-notes-row">
            <textarea
              className="bc-notes-input"
              value={notes}
              onChange={handleNotesChange}
              placeholder="Notities…"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  )
}
