export function SkeletonLine({ width = '100%', height = 12, radius = 4, style }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'var(--bg3, #2a2a2a)',
      animation: 'skeleton-pulse 1.4s ease-in-out infinite',
      ...style,
    }} />
  )
}

export function SkeletonBlock({ lines = 3, gap = 8 }) {
  const widths = ['85%', '70%', '90%', '60%', '80%', '75%']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  )
}

const KEYFRAMES = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
  const style = document.createElement('style')
  style.id = 'skeleton-styles'
  style.textContent = KEYFRAMES
  document.head.appendChild(style)
}
