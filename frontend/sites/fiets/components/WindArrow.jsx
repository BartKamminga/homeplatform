// Pijl wijst in de richting waar de wind naartoe waait (wind_dir + 180, want
// wind_dir is de meteorologische "komt van"-richting). Grootte en dikte
// schalen mee met de windsnelheid.
export default function WindArrow({ deg, kmh, color = 'currentColor' }) {
  if (deg == null || kmh == null) return null

  const travelDeg = (deg + 180) % 360
  const size = Math.min(32, 14 + kmh * 0.6)
  const thickness = Math.min(4, 1.5 + kmh * 0.06)

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1, color }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${travelDeg}deg)`, flexShrink: 0 }}>
        <line x1="12" y1="21" x2="12" y2="5" stroke="currentColor" strokeWidth={thickness} strokeLinecap="round" />
        <path
          d={`M12,2 L${12 - thickness * 1.8},9 L${12 + thickness * 1.8},9 Z`}
          fill="currentColor"
        />
      </svg>
      <span style={{ fontSize: 8, lineHeight: 1 }}>💨</span>
    </span>
  )
}
