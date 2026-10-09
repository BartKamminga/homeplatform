import { stripFormatting } from './FormattedText.jsx'
import FifaCard from '../features/players/FifaCard.jsx'
import usePlayerCards from '../features/players/usePlayerCards.js'

// Speelster van de week (item 1200): bovenaan de "In de kijker"-sectie op de
// homepagina. Foto + naam + (ingekorte) bio, klik = naar haar spelerspagina.
export default function PlayerSpotlightCard({ spotlight, onOpenPlayer }) {
  const cards = usePlayerCards()
  if (!spotlight) return null
  const p = spotlight.player
  const card = cards[p.id]
  const name = p.nickname || p.name
  const bio = stripFormatting(p.bio || '')
  const meta = [p.role_title || p.position, !p.role_title && p.shirt_number ? `#${p.shirt_number}` : null].filter(Boolean).join(' · ')

  return (
    <a href="#" onClick={e => { e.preventDefault(); onOpenPlayer?.(p.id) }} className="yof-card"
      style={{
        display: 'flex', gap: 14, textDecoration: 'none', color: 'inherit', padding: 0, overflow: 'hidden',
        border: '2px solid #f4c81e',
      }}>
      {/* Live FIFA-kaart (speelster van de week = standaard goud) i.p.v. de foto */}
      {card ? <div style={{ width: 120, flexShrink: 0, padding: 6 }}><FifaCard player={p} card={card} /></div> : (
      <div style={{ width: 110, flexShrink: 0, aspectRatio: '3 / 4', background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)' }}>
        {p.photo_url
          ? <img src={p.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f4c81e', fontSize: 32, fontWeight: 800 }}>
              {p.shirt_number ?? name.charAt(0)}
            </div>}
      </div>
      )}
      <div style={{ padding: '12px 12px 12px 0', minWidth: 0 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#a3245c', fontWeight: 700, marginBottom: 4 }}>
          ⭐ Speelster van de week
        </div>
        <h3 style={{ margin: '0 0 2px', fontSize: 17 }}>{name}</h3>
        {meta && <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{meta}</div>}
        {bio && (
          <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.45 }}>
            {bio.length > 140 ? bio.slice(0, 140) + '...' : bio}
          </p>
        )}
      </div>
    </a>
  )
}
