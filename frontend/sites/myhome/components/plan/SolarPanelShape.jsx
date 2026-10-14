// Zonnepaneel op de plattegrond: rechthoek in paneelmaat (meta.panel), gekleurd naar het live vermogen.
// Gecentreerd op de positie van het apparaat; draaibaar; "?" als de koppeling met de omvormer nog onzeker is.

export function panelDims(device) {
  const p = device.meta?.panel || {}
  const w = p.w || 1.0
  const h = p.h || 1.7
  return p.orientation === 'portrait' ? [w, h] : [h, w]
}

export function panelColor(watt, max) {
  if (watt == null || !max) return '#8e979a'
  const t = Math.max(0, Math.min(1, watt / max))
  const lerp = (a, b) => Math.round(a + (b - a) * t)
  return `rgb(${lerp(24, 255)}, ${lerp(52, 196)}, ${lerp(98, 64)})`
}

export default function SolarPanelShape({ device, watt, max, dead, selected, showLabel, onPointerDown, onClick, onDoubleClick }) {
  const [w, h] = panelDims(device)
  const rot = device.meta?.panel?.rotation || 0
  const unsure = device.meta?.solar_unsure
  const light = watt != null && max && watt / max > 0.55
  return (
    <g transform={`rotate(${rot})`} className="mh-plan-device" onPointerDown={onPointerDown} onClick={onClick} onDoubleClick={onDoubleClick}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={panelColor(watt, max)} rx={0.03}
        stroke={selected ? 'var(--mh-accent)' : dead ? 'var(--mh-bad)' : '#d6dadb'} strokeWidth={selected || dead ? 0.07 : 0.025} />
      <path d={`M${-w / 2},0H${w / 2}M0,${-h / 2}V${h / 2}`} stroke="rgba(255,255,255,.18)" strokeWidth={0.012} pointerEvents="none" />
      <text x={0} y={0.02} textAnchor="middle" dominantBaseline="middle" fontSize={0.2} fontFamily="var(--mh-mono)"
        fill={light ? '#1d2629' : '#ffffff'} pointerEvents="none">
        {dead ? '!' : watt != null ? `${Math.round(watt)} W` : '–'}
      </text>
      {unsure && <text x={w / 2 - 0.1} y={-h / 2 + 0.2} textAnchor="end" fontSize={0.18} fontWeight="700" fill="var(--mh-warn)" pointerEvents="none">?</text>}
      {showLabel && <text y={h / 2 + 0.2} textAnchor="middle" fontSize={0.12} fill="var(--plan-ink)" className="mh-plan-halo" pointerEvents="none">{device.name.replace('Inverter ', '…').slice(-6)}</text>}
      <title>{device.name}</title>
    </g>
  )
}
