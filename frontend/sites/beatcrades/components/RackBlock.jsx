import { useState, useEffect, useRef } from 'react'
import { RackIcon } from './Icons.jsx'
import { CradeRow } from './CradeRow.jsx'
import { PlaceholderRow } from './PlaceholderRow.jsx'
import { updateRack } from '../api.js'
import { FORMATS, FMT_LABEL } from '../helpers.js'

export function RackBlock({ rack,
  openRacks, openCrades, toggleRack, toggleCrade,
  draggingCrade, draggingRack, dragOver, setDragOver,
  onCradeDragStart, onCradeDragEnd,
  onRackDragOver, onRackDrop,
  onRackDragStart, onRackDragEnd,
  onRackMergeDragOver, onRackMergeDrop,
  renameRack, removeRack, removeCrade, onRestartCrade, onCancelCrade,
  renameCrade, addCradeInRack,
  allRacks, onMoveCrade, onLoad,
}) {
  const [fmtOpen, setFmtOpen] = useState(false)
  const fmtRef = useRef(null)

  const isOpen      = rack.id in openRacks ? openRacks[rack.id] : false
  const isDragOver  = dragOver?.kind === 'rack' && dragOver.id === rack.id
  const isMergeOver = dragOver?.kind === 'rack-merge' && dragOver.id === rack.id
  const isReorderOver = dragOver?.kind === 'rack-reorder' && dragOver.id === rack.id
  const isDragging  = draggingRack === rack.id
  const total      = rack.crades.length
  const done       = rack.crades.filter(c => c.status === 'done').length
  const allDone    = total > 0 && done === total
  const trackTotal = rack.crades.reduce((n, c) => n + (c.track_count || 0), 0)

  useEffect(() => {
    if (!fmtOpen) return
    const h = e => { if (fmtRef.current && !fmtRef.current.contains(e.target)) setFmtOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [fmtOpen])

  const setFormat = async fmt => {
    setFmtOpen(false)
    await updateRack(rack.id, { default_format: fmt || null }).catch(() => {})
    onLoad?.()
  }

  return (
    <div className={`bc-rack${isOpen ? ' open' : ''}${isDragOver ? ' dz-over' : ''}${isDragging ? ' dragging' : ''}`}
      data-rack-id={rack.id}
      onDragOver={e => onRackDragOver(e, rack.id)}
      onDrop={e => onRackDrop(e, rack.id)}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}>

      <div className={`bc-rack-head${isMergeOver ? ' bc-rack-head--merge-over' : isReorderOver ? ' bc-rack-head--reorder-over' : ''}`}
        draggable
        onDragStart={e => { e.stopPropagation(); onRackDragStart(e, rack.id) }}
        onDragEnd={onRackDragEnd}
        onDragOver={e => onRackMergeDragOver(e, rack.id)}
        onDrop={e => onRackMergeDrop(e, rack.id)}>
        <span className="bc-drag" title="Rack slepen om te herordenen of samenvoegen">⠿</span>
        <span className="bc-chev" onClick={e => { e.stopPropagation(); toggleRack(rack.id) }}>{isOpen ? '▾' : '▸'}</span>
        <span className="bc-rack-icon"><RackIcon size={17} /></span>
        <span className="bc-rack-name" onClick={e => { e.stopPropagation(); renameRack(rack.id, rack.name) }} title="Klik om te hernoemen">
          {rack.name}
        </span>
        <span className={`bc-rack-count${allDone ? ' bc-rack-count--done' : ''}`}>
          {done}/{total} klaar{trackTotal > 0 ? ` · ${trackTotal} tracks` : ''}
        </span>

        <div className="bc-rack-fmt-wrap" ref={fmtRef} onClick={e => e.stopPropagation()}>
          <button className={`bc-rack-fmt-btn${rack.default_format ? ' bc-rack-fmt-btn--set' : ''}`}
            onClick={() => setFmtOpen(o => !o)}
            title="Standaard formaat voor dit rack">
            {rack.default_format ? (FMT_LABEL[rack.default_format] || rack.default_format.toUpperCase()) : '···'}
          </button>
          {fmtOpen && (
            <div className="bc-rack-fmt-pop">
              <button className={`bc-rack-fmt-opt${!rack.default_format ? ' active' : ''}`}
                onClick={() => setFormat(null)}>— geen —</button>
              {FORMATS.map(f => (
                <button key={f} className={`bc-rack-fmt-opt${rack.default_format === f ? ' active' : ''}`}
                  onClick={() => setFormat(f)}>
                  {FMT_LABEL[f] || f.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="bc-del-btn" onClick={e => { e.stopPropagation(); removeRack(rack.id) }} title="Rack verwijderen">✕</button>
      </div>

      {isOpen && (
        <div className="bc-rack-body">
          {rack.crades.map(crade => (
            <CradeRow key={crade.id} crade={crade}
              open={!!openCrades[crade.id]}
              onToggle={() => toggleCrade(crade.id)}
              onRename={() => renameCrade(crade.id, crade.name)}
              onDelete={() => removeCrade(crade.id)}
              onRestart={() => onRestartCrade(crade.id)}
              onCancel={() => onCancelCrade(crade.id)}
              inRack
              dragging={draggingCrade === crade.id}
              onDragStart={e => onCradeDragStart(e, crade.id)}
              onDragEnd={onCradeDragEnd}
              allRacks={allRacks}
              onMove={onMoveCrade} />
          ))}
          <PlaceholderRow type="crade" onSubmit={url => addCradeInRack(rack.id, url)} />
        </div>
      )}
    </div>
  )
}
