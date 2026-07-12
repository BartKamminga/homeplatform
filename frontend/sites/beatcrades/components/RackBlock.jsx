import { RackIcon } from './Icons.jsx'
import { CradeRow } from './CradeRow.jsx'
import { PlaceholderRow } from './PlaceholderRow.jsx'

export function RackBlock({ rack,
  openRacks, openCrades, toggleRack, toggleCrade,
  draggingCrade, draggingRack, dragOver, setDragOver,
  onCradeDragStart, onCradeDragEnd,
  onRackDragOver, onRackDrop,
  onRackDragStart, onRackDragEnd,
  renameRack, removeRack, removeCrade, onRestartCrade, onCancelCrade,
  renameCrade, addCradeInRack,
}) {
  const isOpen    = rack.id in openRacks ? openRacks[rack.id] : false
  const isDragOver = dragOver?.kind === 'rack' && dragOver.id === rack.id
  const isDragging = draggingRack === rack.id

  return (
    <div className={`bc-rack${isOpen ? ' open' : ''}${isDragOver ? ' dz-over' : ''}${isDragging ? ' dragging' : ''}`}
      onDragOver={e => onRackDragOver(e, rack.id)}
      onDrop={e => onRackDrop(e, rack.id)}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}>

      <div className="bc-rack-head"
        draggable
        onDragStart={e => { e.stopPropagation(); onRackDragStart(e, rack.id) }}
        onDragEnd={onRackDragEnd}>
        <span className="bc-drag" title="Rack slepen naar Section">⠿</span>
        <span className="bc-chev" onClick={e => { e.stopPropagation(); toggleRack(rack.id) }}>{isOpen ? '▾' : '▸'}</span>
        <span className="bc-rack-icon"><RackIcon size={17} /></span>
        <span className="bc-rack-name" onClick={e => { e.stopPropagation(); renameRack(rack.id, rack.name) }} title="Klik om te hernoemen">
          {rack.name}
        </span>
        <span className="bc-rack-count">{rack.crades.length} crades</span>
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
              onDragEnd={onCradeDragEnd} />
          ))}
          <PlaceholderRow type="crade" onSubmit={url => addCradeInRack(rack.id, url)} />
        </div>
      )}
    </div>
  )
}
