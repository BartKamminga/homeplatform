export function SectionIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <path d="M2.5 9.5 L10 2.5 L17.5 9.5"/>
      <path d="M4.5 8.5 L4.5 17.5 L15.5 17.5 L15.5 8.5"/>
      <path d="M8 17.5 L8 13 Q10 11.8 12 13 L12 17.5" strokeWidth="1.2"/>
      <rect x="5.5" y="10" width="2.5" height="2.5" rx="0.4" strokeWidth="1"/>
      <rect x="12.5" y="3.5" width="2" height="3" rx="0.3" strokeWidth="1.1"/>
    </svg>
  )
}

export function RackIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <rect x="2" y="1.5" width="16" height="17" rx="1.2"/>
      <line x1="4.5" y1="1.5" x2="4.5" y2="18.5" strokeWidth="1"/>
      <line x1="15.5" y1="1.5" x2="15.5" y2="18.5" strokeWidth="1"/>
      <rect x="5" y="3.5" width="10" height="3" rx="0.6" strokeWidth="1.1"/>
      <rect x="5" y="8" width="10" height="3" rx="0.6" strokeWidth="1.1"/>
      <rect x="5" y="12.5" width="10" height="3" rx="0.6" strokeWidth="1.1"/>
      <circle cx="3.7" cy="5"    r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="3.7" cy="9.5"  r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="3.7" cy="14"   r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="16.3" cy="5"   r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="16.3" cy="9.5" r="0.5" fill="currentColor" stroke="none"/>
      <circle cx="16.3" cy="14"  r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

export function CradeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <rect x="1.5" y="5" width="17" height="13" rx="1.2"/>
      <line x1="7"  y1="5" x2="7"  y2="18"/>
      <line x1="13" y1="5" x2="13" y2="18"/>
      <line x1="1.5" y1="11" x2="18.5" y2="11"/>
      <path d="M7.5 5 L7.5 3 Q10 1.5 12.5 3 L12.5 5" strokeWidth="1.3"/>
    </svg>
  )
}
