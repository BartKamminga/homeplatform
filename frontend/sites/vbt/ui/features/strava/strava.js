// Strava in VBT: status van jouw koppeling, koppelen (met een openstaande upload die na terugkomst doorgaat)
// en een rit uploaden. Kleine store zodat React (useStrava) meeleeft; de toast meldt het resultaat.
import { useSyncExternalStore } from 'react'

const PENDING = 'vbt.pendingStrava'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let state = { configured: false, connected: false, athleteName: null, busy: false }
const listeners = new Set()
const set = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
const toast = (text, ms) => window.VBT.toast?.(text, ms)
const api = () => window.VBT.strava

export function useStrava() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => state)
}

export async function refresh() {
  if (!api()) return
  try { set(await api().status()) } catch { /* geen server: knop blijft uit */ }
}

export async function connect(pendingRideId) {
  if (pendingRideId) sessionStorage.setItem(PENDING, pendingRideId)
  window.location.href = await api().connectUrl()
}

export async function upload(ride) {
  set({ busy: true })
  try {
    let r = await api().upload(ride.serverId, window.VBT.fit.encode(ride), window.VBT.fit.fileName(ride))
    for (let i = 0; i < 20 && r.stravaStatus === 'uploading'; i++) {
      await sleep(2500)
      r = await api().uploadStatus(ride.serverId)
    }
    if (r.stravaActivityId) {
      ride.stravaActivityId = r.stravaActivityId
      toast('UPLOADED TO STRAVA ✓')
    } else if (r.stravaStatus === 'error') toast('STRAVA: ' + (r.stravaError || 'upload failed'), 7000)
    else toast('STRAVA IS STILL PROCESSING - CHECK YOUR FEED IN A MINUTE')
  } catch (e) {
    toast('STRAVA: ' + e.message, 7000)
  }
  set({ busy: false })
}

// knop op het finish-scherm: koppelen, uploaden of de activiteit openen
export function rideButton(ride) {
  if (!ride) return
  if (ride.stravaActivityId) { window.open('https://www.strava.com/activities/' + ride.stravaActivityId, '_blank'); return }
  if (!state.connected) { connect(ride.serverId); return }
  if (ride.serverId) upload(ride)
}

export function buttonLabel(ride) {
  if (!api() || !state.configured) return { text: 'STRAVA', note: 'not set up', enabled: false }
  if (state.busy) return { text: 'UPLOADING…', enabled: false }
  if (!state.connected) return { text: 'CONNECT STRAVA', enabled: true }
  if (ride && ride.stravaActivityId) return { text: '✓ ON STRAVA', enabled: true }
  return { text: 'UPLOAD TO STRAVA', enabled: !!(ride && ride.serverId) }    // zonder serverId: nog aan het opslaan
}

// Terug van Strava (?strava=connected|denied|scope): openstaande upload alsnog doen
export async function init() {
  await refresh()
  const params = new URLSearchParams(window.location.search)
  const result = params.get('strava')
  if (!result) return
  params.delete('strava')
  const qs = params.toString()
  history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''))
  if (result !== 'connected') {
    toast(result === 'scope' ? 'STRAVA: PLEASE ALLOW UPLOADING ACTIVITIES' : 'STRAVA NOT CONNECTED', 6000)
    return
  }
  toast('STRAVA CONNECTED ✓')
  const pending = sessionStorage.getItem(PENDING)
  sessionStorage.removeItem(PENDING)
  if (!pending) return
  const ride = await window.VBT.storage.getRide(pending).catch(() => null)
  if (ride && !ride.stravaActivityId) {
    ride.serverId = ride.id
    window.VBT.game.lastRide = ride
    upload(ride)
  }
}
