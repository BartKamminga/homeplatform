// Witte hockeybal met deukjes (er bestaat geen emoji voor) - voor doelpunten.
// size in px of een CSS-maat (bv. '1em' om mee te schalen met de tekst).
export default function HockeyBall({ size = '1em', title }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0 }}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#9aa3b5" strokeWidth="1.2" />
      <g fill="#d5dae4">
        <circle cx="12" cy="7" r="1.6" /><circle cx="7.6" cy="10.4" r="1.5" /><circle cx="16.4" cy="10.4" r="1.5" />
        <circle cx="9.3" cy="15.4" r="1.5" /><circle cx="14.7" cy="15.4" r="1.5" /><circle cx="12" cy="11.6" r="1.3" />
      </g>
    </svg>
  )
}
