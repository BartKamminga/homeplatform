import { useEffect, useMemo, useRef, useState } from 'react'
import { ROOM_KINDS, liveSummary } from '../../model.js'
import { DeviceSymbol } from './symbols.jsx'
import { centroid, edgeDimensions, floorBounds, fmtLen, roomAt, snap, toSvgPoint } from './geometry.js'

// 2D-plattegrond van een verdieping in tekeningstijl.
// mode: 'view' | 'walls' (hoekpunten van de gekozen ruimte slepen) | 'place' (apparaten neerzetten/verslepen).
// armed: apparaat (of {quickAdd: kind}) dat bij de volgende klik op de plattegrond geplaatst wordt.
export default function PlanView({
  floor, devices, live, mode, selectedRoomId, onSelectRoom, draft, onDraftChange,
  armed, onPlace, selectedDeviceId, onSelectDevice, showLabels,
}) {
  const svgRef = useRef(null)
  const drag = useRef(null)
  const [view, setView] = useState(null)
  const rooms = floor.rooms
  // Alleen opnieuw kaderen bij een andere verdieping, niet bij elke wijziging van een ruimte.
  const base = useMemo(() => floorBounds(rooms), [floor.key]) // eslint-disable-line

  useEffect(() => { setView(base) }, [base])
  const vb = view || base

  function onWheel(e) {
    e.preventDefault()
    const [px, pz] = toSvgPoint(svgRef.current, e)
    const f = e.deltaY > 0 ? 1.12 : 1 / 1.12
    setView({ x: px - (px - vb.x) * f, z: pz - (pz - vb.z) * f, w: vb.w * f, h: vb.h * f })
  }
  useEffect(() => {
    const el = svgRef.current
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  function onPointerDown(e) {
    if (e.target === svgRef.current || e.target.dataset.bg) {
      drag.current = { type: 'pan', start: toSvgPoint(svgRef.current, e), vb, moved: false }
      svgRef.current.setPointerCapture(e.pointerId)
    }
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const p = toSvgPoint(svgRef.current, e)
    if (d.type === 'pan') {
      const dx = p[0] - d.start[0]
      const dz = p[1] - d.start[1]
      if (Math.abs(dx) + Math.abs(dz) > 0.05) d.moved = true
      setView({ ...d.vb, x: d.vb.x - dx, z: d.vb.z - dz })
      d.vb = { ...d.vb, x: d.vb.x - dx, z: d.vb.z - dz }
    } else if (d.type === 'vertex') {
      const next = draft.map((pt, i) => (i === d.index ? [snap(p[0]), snap(p[1])] : pt))
      onDraftChange(next)
    } else if (d.type === 'device') {
      d.pos = [snap(p[0], 0.01), snap(p[1], 0.01)]
      d.moved = true
      svgRef.current.querySelector(`[data-dev="${d.device.id}"]`)?.setAttribute('transform', `translate(${d.pos[0]},${d.pos[1]})`)
    }
  }
  function onPointerUp(e) {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.type === 'device' && d.moved) onPlace(d.device, d.pos, roomAt(d.pos, rooms))
    if (d.type === 'pan' && !d.moved) {
      const p = toSvgPoint(svgRef.current, e)
      if (mode === 'place' && armed) onPlace(armed, [snap(p[0], 0.01), snap(p[1], 0.01)], roomAt(p, rooms))
      else onSelectRoom(roomAt(p, rooms)?.id || null)
    }
  }

  const selected = rooms.find((r) => r.id === selectedRoomId)
  const editPoly = mode === 'walls' && selected ? draft || selected.polygon : null
  const placed = devices.filter((d) => d.meta?.position && (d.meta.floor ? d.meta.floor === floor.key : true))

  return (
    <svg ref={svgRef} className={`mh-plan ${mode === 'place' && armed ? 'armed' : ''}`} viewBox={`${vb.x} ${vb.z} ${vb.w} ${vb.h}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} role="img" aria-label={`Floor plan ${floor.name}`}>
      <defs>
        <pattern id="mh-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1,0H0V1" fill="none" stroke="var(--plan-grid)" strokeWidth="0.01" />
        </pattern>
        <pattern id="mh-hatch" width="0.25" height="0.25" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0,0V0.25" stroke="var(--plan-grid-strong)" strokeWidth="0.02" />
        </pattern>
      </defs>
      <rect data-bg="1" x={vb.x - vb.w} y={vb.z - vb.h} width={vb.w * 3} height={vb.h * 3} fill="url(#mh-grid)" />

      {rooms.map((r) => {
        const poly = r.id === selected?.id && editPoly ? editPoly : r.polygon
        if (!poly?.length) return null
        const lit = devices.some((d) => d.room_id === r.id && liveSummary(live[d.id]).on)
        const fill = r.kind === 'outdoor' ? 'url(#mh-hatch)' : r.meta?.floor_color || ROOM_KINDS[r.kind]?.color
        return (
          <g key={r.id}>
            <polygon points={poly.map((p) => p.join(',')).join(' ')} fill={fill} fillOpacity={r.kind === 'outdoor' ? 1 : 0.55}
              stroke={r.meta?.wall_color ? 'var(--plan-ink)' : 'var(--plan-ink)'} strokeWidth={r.kind === 'outdoor' ? 0.03 : 0.12}
              strokeLinejoin="miter" className={`mh-plan-room ${r.id === selectedRoomId ? 'sel' : ''}`} />
            {lit && <polygon points={poly.map((p) => p.join(',')).join(' ')} fill="var(--plan-lit)" pointerEvents="none" />}
          </g>
        )
      })}

      {rooms.map((r) => {
        if (!r.polygon?.length) return null
        const [cx, cz] = r.label_at || centroid(r.polygon)
        return (
          <g key={`l-${r.id}`} pointerEvents="none" className="mh-plan-halo">
            <text x={cx} y={cz} textAnchor="middle" fontSize={0.26} fontFamily="var(--mh-display)" fontWeight="600" fill="var(--plan-ink)">{r.name}</text>
            <text x={cx} y={cz + 0.3} textAnchor="middle" fontSize={0.17} fontFamily="var(--mh-mono)" fill="var(--plan-muted)">{fmtLen(r.area_m2)} m²</text>
          </g>
        )
      })}

      {(editPoly || selected?.polygon) && edgeDimensions(editPoly || selected.polygon).map((d) => (
        <text key={`d-${d.index}`} x={d.x} y={d.z} transform={`rotate(${d.angle} ${d.x} ${d.z})`} textAnchor="middle" dominantBaseline="middle"
          fontSize={0.16} fontFamily="var(--mh-mono)" fill="var(--mh-accent)" pointerEvents="none" className="mh-plan-halo">{fmtLen(d.len)}</text>
      ))}

      {editPoly && editPoly.map(([x, z], i) => {
        const [x2, z2] = editPoly[(i + 1) % editPoly.length]
        return (
          <g key={`h-${i}`}>
            <circle cx={(x + x2) / 2} cy={(z + z2) / 2} r={0.09} className="mh-plan-add"
              onPointerDown={(e) => { e.stopPropagation(); const next = [...editPoly]; next.splice(i + 1, 0, [snap((x + x2) / 2), snap((z + z2) / 2)]); onDraftChange(next) }}>
              <title>Add a corner</title>
            </circle>
            <circle cx={x} cy={z} r={0.13} className="mh-plan-vertex"
              onPointerDown={(e) => { e.stopPropagation(); drag.current = { type: 'vertex', index: i }; svgRef.current.setPointerCapture(e.pointerId) }}
              onDoubleClick={() => editPoly.length > 3 && onDraftChange(editPoly.filter((_, j) => j !== i))}>
              <title>Drag to move · double-click to remove</title>
            </circle>
          </g>
        )
      })}

      {placed.map((d) => {
        const s = liveSummary(live[d.id])
        return (
          <g key={d.id} data-dev={d.id} transform={`translate(${d.meta.position[0]},${d.meta.position[1]})`}>
            {s.on && <circle r={0.42} fill="var(--plan-glow)" pointerEvents="none" />}
            {s.motion && <circle r={0.3} className="mh-plan-pulse" pointerEvents="none" />}
            <DeviceSymbol device={d} x={0} z={0} selected={d.id === selectedDeviceId} isNew={d.meta?.review === 'new'} showLabel={showLabels}
              onClick={() => onSelectDevice(d.id)}
              onPointerDown={(e) => {
                if (mode !== 'place') return
                e.stopPropagation()
                drag.current = { type: 'device', device: d, pos: d.meta.position, moved: false }
                svgRef.current.setPointerCapture(e.pointerId)
              }} />
            {s.open && <text x={0.22} y={-0.2} fontSize={0.15} fontWeight="700" fill="var(--mh-bad)" className="mh-plan-halo" pointerEvents="none">OPEN</text>}
          </g>
        )
      })}
    </svg>
  )
}
