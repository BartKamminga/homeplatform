export default function Logo({ size = 32, showName = false, nameStyle = {} }) {
  const h = Math.round(size * 0.75);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28) }}>
      <svg width={size} height={h} viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg">
        {/* Cloud shape via circles + rect */}
        <circle cx="9"  cy="15" r="6"  fill="#3B82F6" />
        <circle cx="16" cy="11" r="8"  fill="#3B82F6" />
        <circle cx="23" cy="15" r="6"  fill="#3B82F6" />
        <rect   x="3"  y="14" width="26" height="8" rx="2" fill="#3B82F6" />
        {/* </> symbol */}
        <text
          x="16" y="20"
          textAnchor="middle"
          fill="white"
          fontFamily="monospace,Consolas,sans-serif"
          fontSize="9"
          fontWeight="800"
          letterSpacing="-0.5"
        >{'</>'}</text>
      </svg>
      {showName && (
        <span style={{
          fontWeight: 700,
          fontSize: Math.round(size * 0.5),
          letterSpacing: '-0.02em',
          color: 'var(--color-text)',
          ...nameStyle,
        }}>
          WebHeaven
        </span>
      )}
    </span>
  );
}
