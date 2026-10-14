import { useRef } from 'react'
import { floorBounds, snap, toSvgPoint } from '../plan/geometry.js'
import { arrayPanels, arraySize, inverterIndex, panelColor } from './solar.js'

// Bovenaanzicht van het huis met de panelenvelden. Velden verslepen; paneel aanklikken om te koppelen.
export default function SolarRoof({ home, solar, inverters, selected, onSelect, onMove }) {
  const svgRef = useRef(null)
  const drag = useRef(null)
  const floors = home.floors
  const top = floors[floors.length - 1]
  const outline = floors.flatMap((f) => f.rooms.filter((r) => r.kind !== 'outdoor').map((r) => ({ ...r, floorKey: f.key })))
  // Kader om huis en alle panelenvelden (een veld kan buiten het huis liggen, bv. op de garage).
  const fieldBoxes = (solar.arrays || []).map((a) => {
    const [aw, ah] = arraySize(a)
    const r = ((a.rotation || 0) * Math.PI) / 180
    const corners = [[0, 0], [aw, 0], [aw, ah], [0, ah]].map(([x, z]) => [a.x + x * Math.cos(r) - z * Math.sin(r), a.z + x * Math.sin(r) + z * Math.cos(r)])
    return { polygon: corners }
  })
  const vb = floorBounds([...outline, ...fieldBoxes], 1.2)
  const watts = Object.values(inverters).map((i) => i.watt).filter((w) => w != null)
  const max = Math.max(1, ...watts)
  const anyOn = watts.some((w) => w > 20)
  const roof = top?.roof
  const ridge = roof?.line?.length ? roof.line.reduce((a, b) => (b[1] > a[1] ? b : a)) : null

  function down(e, a) {
    e.stopPropagation()
    onSelect({ array: a.id })
    const [px, pz] = toSvgPoint(svgRef.current, e)
    drag.current = { a, dx: px - a.x, dz: pz - a.z, moved: false }
    svgRef.current.setPointerCapture(e.pointerId)
  }
  function move(e) {
    const d = drag.current
    if (!d) return
    const [px, pz] = toSvgPoint(svgRef.current, e)
    d.pos = [snap(px - d.dx), snap(pz - d.dz)]
    d.moved = true
    svgRef.current.querySelector(`[data-arr="${d.a.id}"]`)?.setAttribute('transform', `translate(${d.pos[0]},${d.pos[1]}) rotate(${d.a.rotation || 0})`)
  }
  function up() {
    const d = drag.current
    drag.current = null
    if (d?.moved) onMove(d.a.id, d.pos)
  }

  return (
    <svg ref={svgRef} className="mh-plan mh-solar" viewBox={`${vb.x} ${vb.z} ${vb.w} ${vb.h}`}
      onPointerMove={move} onPointerUp={up} onPointerDown={() => onSelect(null)} role="img" aria-label="Roof with solar panels">
      <defs>
        <pattern id="mh-grid-s" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1,0H0V1" fill="none" stroke="var(--plan-grid)" strokeWidth="0.01" />
        </pattern>
      </defs>
      <rect x={vb.x - vb.w} y={vb.z - vb.h} width={vb.w * 3} height={vb.h * 3} fill="url(#mh-grid-s)" />
      {outline.map((r) => (
        <polygon key={r.id} points={r.polygon.map((p) => p.join(',')).join(' ')} pointerEvents="none"
          fill={r.floorKey === top?.key ? 'var(--solar-roof)' : 'none'} stroke="var(--plan-grid-strong)" strokeWidth={0.03} />
      ))}
      {ridge && (
        <g pointerEvents="none">
          <line x1={ridge[0]} y1={roof.z_from} x2={ridge[0]} y2={roof.z_to} stroke="var(--plan-ink)" strokeWidth={0.05} strokeDasharray="0.3 0.15" />
          <text x={ridge[0] + 0.15} y={roof.z_from + 0.4} fontSize={0.22} fill="var(--plan-muted)" fontFamily="var(--mh-mono)">ridge</text>
        </g>
      )}
      <text x={vb.x + vb.w / 2} y={vb.z + 0.6} textAnchor="middle" fontSize={0.32} letterSpacing="0.2" fill="var(--plan-muted)" fontFamily="var(--mh-display)">GARDEN{home.garden_orientation ? ` · ${home.garden_orientation}` : ''}</text>
      <text x={vb.x + vb.w / 2} y={vb.z + vb.h - 0.3} textAnchor="middle" fontSize={0.32} letterSpacing="0.2" fill="var(--plan-muted)" fontFamily="var(--mh-display)">STREET</text>

      {(solar.arrays || []).map((a) => {
        const [aw, ah] = arraySize(a)
        return (
          <g key={a.id} data-arr={a.id} transform={`translate(${a.x},${a.z}) rotate(${a.rotation || 0})`}>
            <rect x={-0.08} y={-0.08} width={aw + 0.16} height={ah + 0.16} rx={0.06} className={`mh-solar-array ${selected?.array === a.id ? 'sel' : ''}`}
              onPointerDown={(e) => down(e, a)} />
            {arrayPanels(a).map((p) => {
              const info = solar.panels?.[p.key] || {}
              const inv = info.serial ? inverters[info.serial] : null
              const dead = inv && anyOn && (inv.watt ?? 0) < 1
              return (
                <g key={p.key} onPointerDown={(e) => { e.stopPropagation(); onSelect({ array: a.id, panel: p.key }) }} className="mh-solar-panel">
                  <rect x={p.x} y={p.z} width={p.w} height={p.h} fill={panelColor(inv?.watt, max)}
                    stroke={selected?.panel === p.key ? 'var(--mh-accent)' : dead ? 'var(--mh-bad)' : 'var(--solar-frame)'} strokeWidth={selected?.panel === p.key || dead ? 0.07 : 0.025} />
                  <text x={p.x + p.w / 2} y={p.z + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={0.2} fontFamily="var(--mh-mono)"
                    fill={inv?.watt != null && inv.watt / max > 0.55 ? '#1d2629' : '#ffffff'} pointerEvents="none">
                    {dead ? '!' : inv ? (inv.watt != null ? `${Math.round(inv.watt)} W` : '–') : info.ref_wh ? `${info.ref_wh}?` : '?'}
                  </text>
                </g>
              )
            })}
            <text x={0} y={-0.2} fontSize={0.22} fontFamily="var(--mh-display)" fontWeight="600" fill="var(--plan-ink)" className="mh-plan-halo" pointerEvents="none">{a.name}</text>
          </g>
        )
      })}
    </svg>
  )
}

export { inverterIndex }
