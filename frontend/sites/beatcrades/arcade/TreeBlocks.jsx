import { useState } from 'react'
import { FORMATS, FMT_LABEL } from '../helpers.js'
import CradeRow from './CradeRow.jsx'

// Section- en rack-blokken plus de inline "toevoegen"-rij (item 1338).

export function AddRow({ placeholder, button, onSubmit }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!val.trim() || busy) return
    setBusy(true)
    try { await onSubmit(val.trim()); setVal('') } finally { setBusy(false) }
  }
  return (
    <div className="bca-add">
      <input className="ac-input" value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') submit() }} aria-label={placeholder} />
      <button type="button" className="ac-btn ac-btn--sm" disabled={!val.trim() || busy} onClick={submit}>{busy ? '…' : button}</button>
    </div>
  )
}

function cradeList(crades, lib, dnd) {
  const a = lib.actions
  return crades.map(c => (
    <CradeRow key={c.id} crade={c} open={lib.open.crade(c.id)} onToggle={() => lib.open.toggleCrade(c.id)}
      onRename={() => a.renameCrade(c.id, c.name)} onDelete={() => a.removeCrade(c.id)}
      onRestart={() => a.restartCrade(c.id)} onCancel={() => a.cancelCrade(c.id)}
      dragProps={dnd.cradeHandle(c.id)} dragging={dnd.drag?.kind === 'crade' && dnd.drag.id === c.id} />
  ))
}
export { cradeList }

export function RackBlock({ rack, lib, dnd }) {
  const [fmtOpen, setFmtOpen] = useState(false)
  const isOpen = lib.open.rack(rack.id)
  const done = rack.crades.filter(c => c.status === 'done').length
  const tracks = rack.crades.reduce((n, c) => n + (c.track_count || 0), 0)
  const mode = dnd.rackHeadMode(rack.id)
  const headOver = dnd.isOver('rack-head', rack.id)
  const a = lib.actions

  return (
    <div className={`bca-rack${dnd.isOver('rack', rack.id) ? ' over' : ''}`} {...dnd.rackZone(rack.id)}>
      <div className={`bca-rack-head${headOver ? ` ${mode}` : ''}`} {...dnd.rackHandle(rack.id)} {...dnd.rackHeadZone(rack.id)}>
        <span className="bca-drag" title="Drag to reorder or merge">⠿</span>
        <button type="button" className="bca-chev" onClick={() => lib.open.toggleRack(rack.id)} aria-label={isOpen ? 'Collapse' : 'Expand'}>{isOpen ? '▾' : '▸'}</button>
        <button type="button" className="bca-rack-name" onClick={() => a.renameRack(rack.id, rack.name)} title="Rename">{rack.name}</button>
        <span className={`bca-count${rack.crades.length && done === rack.crades.length ? ' all' : ''}`}>
          {done}/{rack.crades.length} DONE{tracks ? ` · ${tracks} TRACKS` : ''}
        </span>
        <div className="bca-fmt">
          <button type="button" className={`ac-pill ${rack.default_format ? 'tag' : 'fmt'}`} onClick={() => setFmtOpen(o => !o)} title="Default format for this rack">
            {rack.default_format ? FMT_LABEL[rack.default_format] : '···'}
          </button>
          {fmtOpen && (
            <div className="bca-pop" onMouseLeave={() => setFmtOpen(false)}>
              {[null, ...FORMATS].map(f => (
                <button key={f ?? 'none'} type="button" className={rack.default_format === f ? 'on' : ''}
                  onClick={() => { setFmtOpen(false); a.setRackFormat(rack.id, f) }}>{f ? FMT_LABEL[f] : 'NONE'}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="ac-icon danger" onClick={() => a.removeRack(rack.id)} aria-label="Delete rack">✕</button>
      </div>
      {isOpen && (
        <div className="bca-rack-body">
          {cradeList(rack.crades, lib, dnd)}
          <AddRow placeholder="URL: Beatport, YouTube or SoundCloud…" button="↓ START" onSubmit={url => a.addCradeInRack(rack.id, url)} />
        </div>
      )}
    </div>
  )
}

export function SectionBlock({ section, lib, dnd }) {
  const isOpen = lib.open.section(section.id)
  const crades = section.racks.flatMap(r => r.crades)
  const done = crades.filter(c => c.status === 'done').length
  const a = lib.actions

  return (
    <div className={`bca-section${dnd.isOver('section', section.id) ? ' over' : ''}${dnd.drag?.kind === 'section' && dnd.drag.id === section.id ? ' dragging' : ''}`}
      {...dnd.sectionZone(section.id)}>
      <div className={`bca-section-head${dnd.isOver('section-head', section.id) ? ' merge' : ''}`} {...dnd.sectionHeadZone(section.id)}>
        <span className="bca-drag" title="Drag onto another section to merge" {...dnd.sectionHandle(section.id)}>⠿</span>
        <button type="button" className="bca-chev" onClick={() => lib.open.toggleSection(section.id)} aria-label={isOpen ? 'Collapse' : 'Expand'}>{isOpen ? '▾' : '▸'}</button>
        <button type="button" className="bca-section-name" onClick={() => a.renameSection(section.id, section.name)} title="Rename">{section.name.toUpperCase()}</button>
        <span className={`bca-count${crades.length && done === crades.length ? ' all' : ''}`}>
          {section.racks.length} RACKS · {done}/{crades.length} DONE
        </span>
        <button type="button" className="ac-icon danger" onClick={() => a.removeSection(section.id)} aria-label="Delete section">✕</button>
      </div>
      {isOpen && (
        <div className="bca-section-body">
          {section.racks.map(r => <RackBlock key={r.id} rack={r} lib={lib} dnd={dnd} />)}
          <AddRow placeholder="Name of a new rack…" button="+ RACK" onSubmit={name => a.addRack(section.id, name)} />
        </div>
      )}
    </div>
  )
}
