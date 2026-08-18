import { useState } from 'react'
import { C, cardStyle, badgeStyle, pinButtonStyle } from './constants.js'
import { PoolTable } from './PoolTable.jsx'

// Eén gedeelde kaart voor het tonen van een poulestand — gebruikt op de browse-
// pagina (DiscPouleTable-context), het board (PinnedPoolSlot) en de
// multi-poule Tournix-weergave (StandingsTable). Density regelt de dichtheid
// van de tabel (compact = alleen #/Team/Pt), niet de kaart-chrome eromheen —
// die is nu overal gelijk (item 665).
//
// Props:
//   title:      string, bv. "Poule A" of poule.name
//   subtitle:   optioneel, bv. toernooi-/publicatienaam
//   tags:       optioneel [{id, name}] — badges onder de titel
//   rows:       genormaliseerde standings-rijen (zie PoolTable)
//   club:       clubnaam voor rij-highlight
//   density:    'full' | 'compact'
//   onOpen:     fn — klik op titel opent wedstrijd-modal (optioneel)
//   pinned:     bool — toont pin-status (optioneel, geen pin-knop als weggelaten)
//   onTogglePin: fn
export function PouleCard({
  title, subtitle, tags, rows, club, density = 'full', onOpen, pinned, onTogglePin,
}) {
  const [showLogos, setShowLogos] = useState(true)
  const compact = density === 'compact'
  const clickable = !!onOpen && rows.length > 0

  return (
    <div style={cardStyle(10)}>
      <div style={{ padding: compact ? '4px 6px 4px 10px' : '5px 6px 5px 10px',
        fontSize: compact ? 10 : 11, fontWeight: 700, letterSpacing: '0.08em',
        color: C.gold, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={clickable ? onOpen : undefined}
          style={{
            flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left',
            cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit', color: 'inherit',
            fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
          {title}{clickable && <span style={{ color: C.muted, fontSize: 9 }}> ›</span>}
        </button>
        {subtitle && (
          <span style={{ color: C.muted, fontWeight: 400, fontSize: 10, whiteSpace: 'nowrap',
            flexShrink: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setShowLogos(v => !v) }}
          title={showLogos ? 'Clublogo\'s verbergen' : 'Clublogo\'s tonen'}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 11, opacity: showLogos ? 1 : 0.4, flexShrink: 0, lineHeight: 1 }}>🖼</button>
        {onTogglePin && (
          <button onClick={e => { e.stopPropagation(); onTogglePin() }}
            style={pinButtonStyle(pinned)}>📌</button>
        )}
      </div>
      {tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '5px 10px 0' }}>
          {tags.map((t, i) => (
            <span key={t.id ?? i} style={badgeStyle()}>{t.name}</span>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
          Nog geen stand
        </div>
      ) : (
        <PoolTable rows={rows} club={club} compact={compact} showLogos={showLogos} />
      )}
    </div>
  )
}
