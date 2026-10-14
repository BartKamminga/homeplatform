// Frontend-variant per site (item 1336): 'classic' (bestaande UI) of 'arcade' (VBT-stijl).
// Keuze per gebruiker in user_preferences.extra (ui_variant_<site>), met localStorage als snelle cache.
// ?ui=arcade|classic in de URL overschrijft en wordt meteen opgeslagen.
import { api } from './api.js'
import { loadUiPrefs } from './uiPrefs.js'

export const VARIANTS = ['classic', 'arcade']
const prefKey = site => `ui_variant_${site}`

function readLocal(site) {
  try { return localStorage.getItem(prefKey(site)) } catch { return null }
}
function writeLocal(site, value) {
  try { localStorage.setItem(prefKey(site), value) } catch { /* privé-venster */ }
}
function urlVariant() {
  const v = new URLSearchParams(window.location.search).get('ui')
  return VARIANTS.includes(v) ? v : null
}

export function getVariant(site) {
  const fromUrl = urlVariant()
  if (fromUrl) { writeLocal(site, fromUrl); return fromUrl }
  const local = readLocal(site)
  return VARIANTS.includes(local) ? local : 'classic'
}

// Na inloggen: server-voorkeur ophalen; wijkt die af van de geladen variant, dan herladen.
// Kwam de keuze uit de URL, dan gaat die juist naar de server.
export async function syncVariant(site, current) {
  if (urlVariant()) {
    await api.patch('/api/auth/me/ui-prefs', { [prefKey(site)]: current }).catch(() => {})
    return
  }
  const prefs = await loadUiPrefs()
  const server = prefs[prefKey(site)]
  if (VARIANTS.includes(server) && server !== current) {
    writeLocal(site, server)
    window.location.reload()
  }
}

export async function setVariant(site, value) {
  if (!VARIANTS.includes(value)) return
  writeLocal(site, value)
  await api.patch('/api/auth/me/ui-prefs', { [prefKey(site)]: value }).catch(() => {})
  const url = new URL(window.location.href)
  url.searchParams.delete('ui')
  window.location.replace(url.toString())
}
