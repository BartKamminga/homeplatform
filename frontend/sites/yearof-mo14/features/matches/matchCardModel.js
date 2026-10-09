// Gegevens voor de wedstrijdkaart (A/B/C) uit een timeline-item - pure functies.
// Alleen voor wedstrijden met twee clubs (competitie); anders null en blijft
// de oude weergave staan.

export const HEADER_STYLES = [
  { value: 'A', label: 'A - Diagonaal vlak' },
  { value: 'B', label: 'B - Scorebord' },
  { value: 'C', label: 'C - Compact' },
]
export const DEFAULT_HEADER_STYLE = 'A'
export const DEFAULT_LIST_STYLE = 'C'
export const DEFAULT_HOME_STYLE = 'C'
export const headerSettingId = matchRef => `header:${matchRef}`

// Stijl van een wedstrijd per plek: kop (wedstrijdpagina), lijst (wedstrijdenlijst) of
// home (Laatste/Volgende wedstrijd op de startpagina). Per wedstrijd ("header:<ref>"
// style / list_style / home_style), anders de standaard van de pagina Wedstrijden
// (page.timeline match_header / list_style / home_style), anders A / C / C.
const STYLE_KEYS = {
  header: ['style', 'match_header', DEFAULT_HEADER_STYLE],
  list: ['list_style', 'list_style', DEFAULT_LIST_STYLE],
  home: ['home_style', 'home_style', DEFAULT_HOME_STYLE],
}
export function matchStyle(setting, matchRef, kind = 'header') {
  const [key, pageKey, fallback] = STYLE_KEYS[kind]
  return setting(headerSettingId(matchRef), key, null) || setting('page.timeline', pageKey, fallback)
}

// Zonder (bekende) clubkleur: neutraal grijsblauw
const FALLBACK_COLOR = '#9aa5c0'

// Leesbare tekstkleur op een achtergrondkleur (zwart of wit)
export function inkFor(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '')
  if (!m) return '#141414'
  const [r, g, b] = m.slice(1).map(v => parseInt(v, 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.55 ? '#141414' : '#ffffff'
}

// Onbekende aanvangstijd komt binnen als middernacht (T00:00) - dan geen tijd tonen
function hasTime(iso) {
  const d = new Date(iso)
  return !(d.getHours() === 0 && d.getMinutes() === 0)
}

export function toCardModel(item) {
  if (!item || item.kind !== 'competitie') return null
  const [homeName, awayName] = (item.title || '').split(' - ')
  if (!homeName || !awayName) return null
  const d = new Date(item.date)
  const valid = !Number.isNaN(d.getTime())
  const scoreHome = item.score_home ?? null
  const scoreAway = item.score_away ?? null
  const side = (name, prefix) => {
    const color = item[`${prefix}_club_color`] || FALLBACK_COLOR
    return { name, logo: item[`${prefix}_club_logo`], color, ink: inkFor(color), clubId: item[`${prefix}_club_id`] }
  }
  return {
    kindLabel: 'Competitie',
    dateLabel: valid ? d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '',
    timeLabel: valid && hasTime(item.date) ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '',
    played: scoreHome != null && scoreAway != null,
    scoreHome, scoreAway,
    location: item.location,
    home: side(homeName, 'home'),
    away: side(awayName, 'away'),
  }
}

// "Victoria MO14-1" -> twee regels: club boven, team eronder
export const splitTeam = name => name.replace(/ (M[OJ]\d+-\d+|[DH]\d+|JO\d+-\d+)$/, '\n$1')
