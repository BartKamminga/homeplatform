import { useEffect, useRef, useState } from 'react'
import { WIDTH, HEIGHT, PAD_TOP, PAD_BOTTOM, HANDLE_Y, LABEL_MIN_Y, C, FONT_HUD, FONT_PIXEL } from './geometry.js'

// Onderdelen van de arcade-grafiek (item 1337).

export function NightBands({ bands, xAt, innerH }) {
  return bands.map(([s, e], i) => (
    <rect key={`night-${i}`} x={xAt(s)} y={PAD_TOP} width={Math.max(1, xAt(e) - xAt(s))} height={innerH} fill={C.purple} fillOpacity={0.12} />
  ))
}

// Sleepbaar tijdvak (cyaan band met twee grepen); pointer events, dus muis en touch.
export function HighlightBand({ range, xAt, bottom, n, onDrag }) {
  const [dragging, setDragging] = useState(null)
  const dragRef = useRef({ svg: null, edge: null })

  useEffect(() => {
    if (!dragging) return
    function toIndex(clientX) {
      const svg = dragRef.current.svg
      if (!svg) return 0
      const rect = svg.getBoundingClientRect()
      const x = (clientX - rect.left) / ((rect.width / WIDTH) || 1)
      return Math.max(0, Math.min(n - 1, Math.round((x / WIDTH) * (n - 1))))
    }
    const move = e => onDrag(dragRef.current.edge, toIndex(e.clientX))
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging, n, onDrag])

  if (!range) return null
  const [s, e] = range
  const start = (edge, ev) => {
    ev.preventDefault()
    dragRef.current = { svg: ev.currentTarget.ownerSVGElement, edge }
    setDragging(edge)
  }
  const handle = (edge, x) => (
    <g key={edge} onPointerDown={ev => start(edge, ev)} style={{ cursor: 'ew-resize', touchAction: 'none' }}>
      <rect x={x - 12} y={0} width={24} height={bottom} fill="transparent" />
      <rect x={x - 6} y={HANDLE_Y - 6} width={12} height={12} rx={2} fill={C.cyan} stroke={C.bg} strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 4px ${C.cyan})` }} />
    </g>
  )
  return (
    <g>
      <rect x={xAt(s)} y={PAD_TOP} width={Math.max(1, xAt(e) - xAt(s))} height={bottom - PAD_TOP} fill={C.cyan} fillOpacity={0.13} />
      <line x1={xAt(s)} x2={xAt(s)} y1={PAD_TOP} y2={bottom} stroke={C.cyan} strokeWidth={2} />
      <line x1={xAt(e)} x2={xAt(e)} y1={PAD_TOP} y2={bottom} stroke={C.cyan} strokeWidth={2} />
      {handle('start', xAt(s))}
      {handle('end', xAt(e))}
    </g>
  )
}

export function NowMarker({ x, bottom, label }) {
  if (x == null) return null
  return (
    <g>
      <line x1={x} y1={PAD_TOP} x2={x} y2={bottom} stroke={C.pink} strokeWidth={1.5} strokeDasharray="4,3" />
      <text x={x + 4} y={bottom - 5} fill={C.pink} fontFamily={FONT_PIXEL} fontSize={7}>{label.toUpperCase()}</text>
    </g>
  )
}

// Waarde-labels; gelijke opeenvolgende waarden maar één keer (item 948).
export function HourLabels({ hourTicks, xAt, yAt, fmt, values, hours }) {
  let last = null
  return hourTicks.map(i => {
    const label = fmt(values[i])
    const show = label !== last
    if (show) last = label
    return (
      <g key={`hour-${i}`}>
        {show && (
          <text x={xAt(i)} y={Math.max(LABEL_MIN_Y, yAt(i) - 8)} textAnchor="middle" fill={C.ink} fontFamily={FONT_HUD} fontSize={10} fontWeight={700}>{label}</text>
        )}
        <text x={xAt(i)} y={HEIGHT - PAD_BOTTOM + 15} textAnchor="middle" fill={C.muted} fontFamily={FONT_HUD} fontSize={9}>
          {hours[i]?.time?.slice(11, 16)}
        </text>
      </g>
    )
  })
}

export function DayTicks({ dayTicks, baseline }) {
  return dayTicks.map((tick, i) => (
    <g key={`day-${i}`}>
      {i > 0 && <line x1={tick.x} y1={PAD_TOP} x2={tick.x} y2={baseline} stroke={C.purple} strokeOpacity={0.6} strokeDasharray="3,3" />}
      <text x={tick.centerX} y={HEIGHT - 8} textAnchor="middle" fill={C.cyan} fontFamily={FONT_PIXEL} fontSize={8}>{tick.label}</text>
    </g>
  ))
}

// Windpijl in reisrichting; lengte en dikte schalen met de snelheid (zelfde formule als classic).
export function WindArrowMark({ x, y, deg, kmh, color, halo }) {
  const size = Math.min(32, 14 + kmh * 0.6)
  const thick = Math.min(4, 1.5 + kmh * 0.06)
  const travel = (deg + 180) % 360
  return (
    <g>
      {halo && <circle cx={x} cy={y} r={size / 2 + 4} fill={C.bg} opacity={0.8} />}
      <g transform={`translate(${x},${y}) rotate(${travel})`} stroke={color} fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
        <line x1={0} y1={size / 2} x2={0} y2={-size / 2} strokeWidth={thick} strokeLinecap="round" />
        <path d={`M0,${-size / 2 - thick * 1.8} L${-thick * 1.8},${-size / 2 + thick * 1.8} L${thick * 1.8},${-size / 2 + thick * 1.8} Z`} stroke="none" />
      </g>
    </g>
  )
}
