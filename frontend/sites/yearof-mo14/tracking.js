import { postVisit } from './api.js'

// Bezoeken tellen per deelbare link (item 1193). visitor_id = willekeurige
// id per apparaat (unieke bezoekers), geen IP. Ingelogde beheerders herkent de
// backend zelf; "niet meetellen" is voor je eigen telefoon zonder login.
const VISITOR_KEY = 'yof_visitor_id'
const NO_TRACK_KEY = 'yof_no_track'

function visitorId() {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

export const isTrackingDisabled = () => localStorage.getItem(NO_TRACK_KEY) === '1'
export function setTrackingDisabled(disabled) {
  if (disabled) localStorage.setItem(NO_TRACK_KEY, '1')
  else localStorage.removeItem(NO_TRACK_KEY)
}

// WhatsApp opent linkjes vaak in een eigen in-app-browser met eigen opslag -
// daar werkt het vinkje in het beheer niet. Eenmalig /yearof-mo14/?notrack=1
// openen in die browser zet "niet meetellen" daar aan.
if (new URLSearchParams(window.location.search).get('notrack') === '1') setTrackingDisabled(true)

// kind: site | match | player | contribute. Met "niet meetellen" (of ingelogd)
// wordt het bezoek wel opgeslagen, maar als beheerder-bezoek apart getoond.
export function trackVisit(kind, code) {
  if (!code) return
  postVisit({ kind, code, visitor_id: visitorId(), excluded: isTrackingDisabled() }).catch(() => {})
}
