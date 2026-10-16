import { useState, useEffect } from 'react'

// Elke pagina een eigen URL in de hash (item 1363), zoals keelson: #team,
// #timeline, #match/<matchRef>, #player/<id>, #page/<id>; leeg = home.
// Navigeren zet de hash (nieuw history-item), dus Terug in browser of app
// gaat naar de vorige pagina i.p.v. de site te verlaten.
const KEYED = { entry: ['match', 'ref'], player: ['player', 'id'], custom: ['page', 'id'] }
// Vaste pagina's van PublicSite; een onbekende hash (oude of verkeerd getypte link) = home.
const PAGES = ['action', 'spotlight', 'team', 'timeline', 'competition', 'topklasse', 'upload']

export function hashForView(view) {
  if (!view || view.name === 'home') return ''
  const keyed = KEYED[view.name]
  return keyed ? `#${keyed[0]}/${encodeURIComponent(view[keyed[1]])}` : `#${view.name}`
}

export function viewFromHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { name: 'home' }
  const slash = raw.indexOf('/')
  const head = slash < 0 ? raw : raw.slice(0, slash)
  const key = slash < 0 ? '' : decodeURIComponent(raw.slice(slash + 1))
  const keyed = Object.entries(KEYED).find(([, [slug]]) => slug === head)
  if (keyed) return key ? { name: keyed[0], [keyed[1][1]]: key } : { name: 'home' }
  return PAGES.includes(head) ? { name: head } : { name: 'home' }
}

// Oude deeplink ?match=<ref> (gedeeld in WhatsApp) omzetten naar #match/<ref>.
function migrateLegacyMatchParam() {
  const url = new URL(window.location.href)
  const ref = url.searchParams.get('match')
  if (!ref) return
  url.searchParams.delete('match')
  url.hash = hashForView({ name: 'entry', ref })
  window.history.replaceState(null, '', url.toString())
}

// enabled = false (admin-preview): view blijft lokale state, de URL is van het beheer.
export default function useHashView(enabled) {
  const [view, setLocalView] = useState(() => {
    if (!enabled) return { name: 'home' }
    migrateLegacyMatchParam()
    return viewFromHash()
  })

  useEffect(() => {
    if (!enabled) return
    const onHash = () => {
      setLocalView(viewFromHash())
      window.scrollTo(0, 0)
    }
    // popstate erbij: Terug naar het home-item (pushState zonder hash) geeft niet overal een hashchange
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [enabled])

  function setView(next) {
    if (!enabled) return setLocalView(next)
    const hash = hashForView(next)
    if (hash === window.location.hash) return
    if (hash) window.location.hash = hash
    else {
      // naar home: hash leeg maken zonder kale '#' in de adresbalk
      window.history.pushState(null, '', window.location.pathname + window.location.search)
      setLocalView({ name: 'home' })
      window.scrollTo(0, 0)
    }
  }

  return [view, setView]
}
