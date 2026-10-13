// Feedback na de rit (item 1304): hoe zwaar was het (RPE 1-10, Borg CR10) en hoe voel je je.
// Direct op het rit-object; naar de server zodra de rit daar staat (op het finish-scherm kan dat nog even duren).
export const RPE = [
  { v: 1, label: 'VERY EASY', color: '#2bd67b' }, { v: 2, label: 'VERY EASY', color: '#2bd67b' },
  { v: 3, label: 'EASY', color: '#7ad84a' }, { v: 4, label: 'EASY', color: '#b8d93a' },
  { v: 5, label: 'MODERATE', color: '#ffe66d' }, { v: 6, label: 'MODERATE', color: '#ffc04d' },
  { v: 7, label: 'HARD', color: '#ff9640' }, { v: 8, label: 'HARD', color: '#ff6a3d' },
  { v: 9, label: 'VERY HARD', color: '#ff2e88' }, { v: 10, label: 'MAX EFFORT', color: '#c13bff' },
]
export const READINESS = [
  { v: 'fresh', label: 'FRESH' }, { v: 'ok', label: 'OK' }, { v: 'tired', label: 'TIRED' }, { v: 'wrecked', label: 'WRECKED' },
]

const serverId = ride => ride.serverId || (ride.id && !String(ride.id).startsWith('local:') && ride.id !== ride.clientId ? ride.id : null)

async function send(ride) {
  const id = serverId(ride)
  if (!id || !ride.pendingFeedback) return
  const patch = ride.pendingFeedback
  ride.pendingFeedback = null
  try { await window.VBT.storage.rideFeedback(id, patch) } catch (e) {
    ride.pendingFeedback = { ...patch, ...(ride.pendingFeedback || {}) }      // later opnieuw
    window.VBT.toast?.('FEEDBACK NOT SAVED YET: ' + e.message, 5000)
  }
}

export function saveFeedback(ride, patch) {
  Object.assign(ride, patch)
  ride.pendingFeedback = { ...(ride.pendingFeedback || {}), ...patch }
  window.VBT.store?.log('save', 'Feedback: ' + Object.entries(patch).map(([k, v]) => k + ' ' + v).join(', '))
  return send(ride)
}

// finish-scherm: zodra de rit een serverId heeft, openstaande feedback alsnog versturen
export const flushFeedback = ride => send(ride)

export const rpeInfo = v => RPE.find(r => r.v === v)
