export const C = {
  bg:     '#0b3427',
  deep:   '#082a20',
  card:   '#10402f',
  chalk:  '#f3efe3',
  muted:  '#8fab9d',
  gold:   '#cf9f3f',
  goldBr: '#e8bf68',
  border: 'rgba(143,171,157,0.18)',
}

export const SEASON     = '2026-2027'
export const CATEGORIES = ['MO14', 'JO14', 'MO16', 'JO16', 'MO18', 'JO18']

export const CLUB_KEY      = 'pb_club'
export const BOARD_KEY     = 'pb_board_on'
export const PINS_KEY      = 'pb_pins'
export const POOL_PINS_KEY = 'pb_pool_pins'
export const MY_BOARDS_KEY = 'pb_my_boards'
export const QUERY_PINS_KEY = 'pb_query_pins'
export const FILTER_PINS_KEY = 'pb_filter_pins'

export const SEIZOEN_INFO = {
  MO18: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 6 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 4', 'Subtopklasse — 16 poules × 4', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie · 14 wedstrijden',
      niveaus: ['Landelijke Competitie — 2 poules × 8', 'Super O18 — 4 poules × 8', 'Subtopklasse — 6 poules × 8', '1e Klasse — per district'] },
    { nr: 3, label: 'Play-offs & NK', periode: '13, 20 en 27 juni',
      niveaus: ['LC: nr. 1+2 → halve finales, finale 27 juni', 'Super O18: nr. 1+2 per poule → finaledag 20 juni'] },
  ],
  JO18: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 6 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 4', 'Subtopklasse — 16 poules × 4', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie · 14 wedstrijden',
      niveaus: ['Landelijke Competitie — 2 poules × 8', 'Super O18 — 4 poules × 8', 'Subtopklasse — 6 poules × 8', '1e Klasse — per district'] },
    { nr: 3, label: 'Play-offs & NK', periode: '13, 20 en 27 juni',
      niveaus: ['LC: nr. 1+2 → halve finales, finale 27 juni', 'Super O18: nr. 1+2 per poule → finaledag 20 juni'] },
  ],
  MO16: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 6', 'Subtopklasse — 8 poules × 6', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie',
      niveaus: ['Landelijke Competitie — 4 poules × 6', 'Super O16 — 4 poules × 6', 'Subtopklasse', '1e Klasse — per district'] },
    { nr: 3, label: 'NK', periode: 'Voorjaar', niveaus: ['LC play-offs', 'Super O16 finaledag'] },
  ],
  JO16: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden',
      niveaus: ['Topklasse — 8 poules × 6', 'Subtopklasse — 8 poules × 6', '1e Klasse — per district'] },
    { nr: 2, label: 'Reguliere competitie', periode: 'Na herfstvakantie',
      niveaus: ['Landelijke Competitie — 4 poules × 6', 'Super O16 — 4 poules × 6', 'Subtopklasse', '1e Klasse — per district'] },
    { nr: 3, label: 'NK', periode: 'Voorjaar', niveaus: ['LC play-offs', 'Super O16 finaledag'] },
  ],
  MO14: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden', niveaus: ['10 poules × 6 (60 teams)'] },
    { nr: 2, label: 'Herindeling', periode: 'Na herfstvakantie',
      niveaus: ['Super O14 — 5 poules × 6 (nr. 1-3)', 'IDC O14 — nr. 4+5', 'Subtopklasse — nr. 6'] },
    { nr: 3, label: 'NK O14', periode: 'Voorjaar', niveaus: ['Super O14: nr. 1+2 per poule → finaledag'] },
  ],
  JO14: [
    { nr: 1, label: 'Voorcompetitie', periode: 'Najaar · 5 wedstrijden', niveaus: ['8 poules × 6 (48 teams)'] },
    { nr: 2, label: 'Herindeling', periode: 'Na herfstvakantie', niveaus: ['4 poules × 6 (nr. 1-3 per poule)'] },
    { nr: 3, label: 'NK O14', periode: 'Voorjaar', niveaus: ['Play-offs vanuit herindeling'] },
  ],
}

export function categoryOf(name = '') {
  const u = name.toUpperCase()
  return CATEGORIES.find(c => u.includes(c)) ?? null
}

// ── Gedeelde style-helpers (item 663) ───────────────────────────────────────
// Vervangen de veelvoorkomende inline pill/badge/card-patronen die voorheen
// apart in elk component werden uitgeschreven.

export function pillStyle(active, size = 'md') {
  return {
    padding: size === 'sm' ? '3px 10px' : '4px 12px',
    borderRadius: size === 'sm' ? 12 : 16,
    fontSize: size === 'sm' ? 10 : 11,
    cursor: 'pointer', fontFamily: 'inherit',
    background: active ? C.gold : 'transparent',
    color: active ? C.deep : C.muted,
    border: `1px solid ${active ? C.gold : C.border}`,
    fontWeight: active ? 700 : 400,
  }
}

export function cardStyle(radius = 10) {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: radius, overflow: 'hidden' }
}

export function badgeStyle() {
  return {
    fontSize: 10, padding: '1px 7px', borderRadius: 10,
    background: 'rgba(207,159,63,0.10)', color: C.gold,
    border: '1px solid rgba(207,159,63,0.22)',
  }
}

// ── Pin-knop-helpers (item 688) ─────────────────────────────────────────────
// Vervangt de ~7 los van elkaar hand-uitgeschreven 📌-knop-stijlen (net iets
// andere padding/border/kleur per plek). size 'xs' = compacte kaart-header-
// knop (PouleCard/QueryCard/TournamentCard), 'sm' = groter touch-target op
// een lijst-rij (PoolSearchCard, filter-pin).

export function pinButtonStyle(pinned, size = 'xs') {
  return {
    background: pinned ? 'rgba(207,159,63,0.15)' : 'transparent',
    border: `1px solid ${pinned ? C.gold : C.border}`,
    borderRadius: size === 'sm' ? 12 : 4,
    padding: size === 'sm' ? '3px 8px' : '1px 5px',
    fontSize: size === 'sm' ? 11 : 10,
    color: pinned ? C.gold : C.muted,
    cursor: 'pointer',
    lineHeight: 1.4,
    flexShrink: 0,
  }
}

// Flush "rail"-variant tegen de rand van een rij/kaart-header (geen radius,
// alleen een scheidingslijn links) - CompBrowseItem's bulk-pin, PinnedFilterRow.
export function pinRailButtonStyle(pinned) {
  return {
    background: pinned ? 'rgba(207,159,63,0.15)' : 'transparent',
    border: 'none',
    borderLeft: `1px solid ${C.border}`,
    padding: '0 14px',
    fontSize: 13,
    color: pinned ? C.gold : C.muted,
    cursor: 'pointer',
    flexShrink: 0,
  }
}
