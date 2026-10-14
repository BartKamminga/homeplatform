import { useState } from 'react'

// Slepen in de boom (item 1338): crade → rack/los, rack → section/los/rack (herordenen of samenvoegen),
// section → section (samenvoegen). Zelfde gedrag als classic App.jsx.
export function useTreeDrag(lib) {
  const [drag, setDrag] = useState(null) // { kind: 'crade'|'rack'|'section', id }
  const [over, setOver] = useState(null) // { kind, id }

  const reset = () => { setDrag(null); setOver(null) }
  const start = (kind, id) => e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDrag({ kind, id }) }
  const isOver = (kind, id) => over?.kind === kind && over.id === id

  // accepts: welke sleep-soort deze zone aanneemt; onDrop krijgt het gesleepte id.
  function zone(kind, id, accepts, onDrop, guard = () => true) {
    return {
      onDragOver: e => {
        if (drag?.kind !== accepts || !guard(drag.id)) return
        e.preventDefault(); e.stopPropagation()
        if (!isOver(kind, id)) setOver({ kind, id })
      },
      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null) },
      onDrop: async e => {
        if (drag?.kind !== accepts || !guard(drag.id)) return
        e.preventDefault(); e.stopPropagation()
        const id0 = drag.id
        reset()
        await onDrop(id0)
      },
    }
  }

  const a = lib.actions
  return {
    drag, isOver, end: reset,
    cradeHandle: id => ({ draggable: true, onDragStart: start('crade', id), onDragEnd: reset }),
    rackHandle: id => ({ draggable: true, onDragStart: start('rack', id), onDragEnd: reset }),
    sectionHandle: id => ({ draggable: true, onDragStart: start('section', id), onDragEnd: reset }),
    rackZone: id => zone('rack', id, 'crade', cid => a.moveCrade(cid, id)),
    rackHeadZone: id => zone('rack-head', id, 'rack', rid => a.dropRackOnRack(rid, id), rid => rid !== id),
    sectionZone: id => zone('section', id, 'rack', rid => a.moveRack(rid, id)),
    sectionHeadZone: id => zone('section-head', id, 'section', sid => a.mergeSection(sid, id), sid => sid !== id),
    rootCradeZone: zone('root-crade', null, 'crade', cid => a.moveCrade(cid, null)),
    rootRackZone: zone('root-rack', null, 'rack', rid => a.moveRack(rid, null)),
    rackHeadMode: id => (drag?.kind === 'rack' && drag.id !== id
      ? (lib.rackSectionId(drag.id) === lib.rackSectionId(id) ? 'reorder' : 'merge') : null),
  }
}
