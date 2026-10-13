// Muziek uit MixMusic tijdens de rit: willekeurige mix (op een willekeurig punt), volgende / aan-uit, en de muziek
// volgt de inspanning:
//  1. filter: bij herstel gedempt ("uit de kamer ernaast"), hoe harder je moet hoe verder het laagdoorlaatfilter
//     opengaat; vanaf drempel (100% FTP) volledig open en voller. Nieuw zwaar interval = korte build-up.
//  2. mixkeuze: zwaar blok (>= 2 min) -> energieke mix, lang herstelblok -> rustigere mix (crossfade).
// Ploegleider spreekt -> muziek zachter. Kleine store (useMusic) voor de HUD-balk en SETTINGS.
import { useSyncExternalStore } from 'react'
import { api } from '@core/api.js'

const HARD = ['Hard', 'Tech', 'Trance', 'Workout', 'Electronic']
const EASY = ['Chillen', 'Klassiek']
const FADE_S = 2.5
let tracks = null, metas = {}, audio = null, ctx = null, filter = null, gain = null
let state = { status: 'off', title: '', tier: null, error: '' }
let lastIntensity = 0.5, lastTier = null, lastIndex = -1, loading = null
const listeners = new Set()
const set = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
const settings = () => window.VBT.settings.values
const log = msg => window.VBT.store?.log('music', msg, 'debug')

// speeltijd naar MixMusic, net als MixMusic zelf: elke 30 s en bij pauze / wisselen / tab dicht
let playFile = null, playStart = null
function flushPlaytime() {
  if (playFile && playStart) {
    const sec = Math.floor((Date.now() - playStart) / 1000)
    if (sec >= 1) api.post('/api/mixmusic/playtime/' + encodeURIComponent(playFile), { seconds: sec }).catch(() => {})
  }
  playStart = state.status === 'playing' ? Date.now() : null
}
setInterval(() => { if (state.status === 'playing') flushPlaytime() }, 30000)
window.addEventListener('pagehide', flushPlaytime)

export function useMusic() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => state)
}

// energie van een mix uit de MixMusic-genres: 2 = energiek, 0 = rustig, 1 = rest
export function tierOf(file) {
  const g = metas[file]?.genres || []
  if (g.some(x => HARD.includes(x))) return 2
  if (g.some(x => EASY.includes(x))) return 0
  return 1
}

// inspanning 0..1.3: doel-%FTP in een workout, anders je eigen vermogen t.o.v. FTP
export function intensityOf(s) {
  if (!s || !['ride', 'countdown'].includes(s.state)) return s && s.state === 'paused' ? 0.3 : 0.6
  const target = s.run && s.run.target
  if (target && target.pct) return Math.min(1.3, target.pct / 100)
  return Math.min(1.3, (s.avg3s || s.watts || 0) / Math.max(50, s.ftp || 180))
}

// filterfrequentie bij een inspanning: 0.5 -> ~700 Hz (gedempt), 0.75 -> ~2,5 kHz, >= 1.0 -> open (18 kHz)
export function cutoffFor(i) {
  const x = Math.max(0, Math.min(1, (i - 0.5) / 0.5))
  return Math.round(700 * Math.pow(18000 / 700, x))
}

async function load() {
  if (tracks) return tracks
  if (!loading) {
    loading = (async () => {
      const [list, m] = await Promise.all([api.get('/api/mixmusic/tracks'), api.get('/api/mixmusic/metas').catch(() => ({}))])
      metas = m || {}
      tracks = (list || []).filter(t => !metas[t.file]?.excluded)
      log('MixMusic: ' + tracks.length + ' tracks')
      return tracks
    })().catch(e => { loading = null; throw e })
  }
  return loading
}

function graph() {
  if (audio) return
  audio = new Audio()
  audio.crossOrigin = 'anonymous'
  audio.preload = 'auto'
  audio.addEventListener('ended', () => next())
  audio.addEventListener('error', () => { if (state.status === 'playing') next() })
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  ctx = new AC()
  filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 18000
  gain = ctx.createGain()
  ctx.createMediaElementSource(audio).connect(filter)
  filter.connect(gain).connect(ctx.destination)
}

function pick(tier) {
  const pool = tracks.filter((t, i) => i !== lastIndex && (tier === null || tierOf(t.file) === tier))
  const from = pool.length ? pool : tracks.filter((_, i) => i !== lastIndex)
  return from.length ? from[Math.floor(Math.random() * from.length)] : tracks[0]
}

// een mix starten (met crossfade als er al iets speelt), op een willekeurig punt als hij lang is
async function playTrack(track, why) {
  graph()
  if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {})
  const t0 = ctx ? ctx.currentTime : 0
  if (gain && state.status === 'playing') gain.gain.setTargetAtTime(0, t0, FADE_S / 4)
  if (state.status === 'playing') await new Promise(r => setTimeout(r, FADE_S * 600))
  flushPlaytime()
  playFile = null
  lastIndex = tracks.indexOf(track)
  audio.src = '/api/mixmusic/stream/' + encodeURIComponent(track.file)
  audio.volume = 1
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration > 600) audio.currentTime = audio.duration * (0.05 + Math.random() * 0.75)
  }, { once: true })
  try { await audio.play() } catch (e) { set({ status: 'blocked', error: 'Click PLAY to start the music' }); return }
  set({ status: 'playing', title: track.name, tier: tierOf(track.file), error: '' })
  playFile = track.file
  playStart = Date.now()
  if (gain) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(volume(), ctx.currentTime, FADE_S / 3) }
  api.post('/api/mixmusic/play/' + encodeURIComponent(track.file)).catch(() => {})
  window.VBT.store?.log('music', 'Music: ' + track.name + (why ? ' (' + why + ')' : ''))
}

const volume = () => (settings().musicVolume ?? 70) / 100

export async function start(why) {
  try {
    await load()
    if (!tracks.length) { set({ status: 'empty', error: 'No music found in MixMusic' }); return }
    await playTrack(pick(why === 'effort' ? lastTier : null), why)
  } catch (e) { set({ status: 'error', error: e.message }) }
}

export function next() { return start('next') }

export function stop() {
  if (audio) audio.pause()
  set({ status: 'off' })
  flushPlaytime()
}

export function toggle() {
  if (state.status === 'playing') { stop(); window.VBT.settings.save({ musicOn: false }) }
  else { window.VBT.settings.save({ musicOn: true }); if (audio && audio.src && state.status === 'off') resume(); else start() }
}

async function resume() {
  if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {})
  try { await audio.play(); set({ status: 'playing' }); playStart = Date.now() } catch { start() }
}

// 4x/s vanuit React: filter en volume volgen de inspanning; mix wisselen bij een zwaar/rustig blok
export function follow(s) {
  if (state.status !== 'playing' || !ctx) return
  const now = ctx.currentTime
  const i = intensityOf(s)
  const on = settings().musicFollow !== false
  const duck = window.VBT.coach?.isSpeaking() ? 0.35 : 1
  filter.frequency.setTargetAtTime(on ? cutoffFor(i) : 18000, now, i > lastIntensity + 0.15 ? 0.6 : 1.5)
  gain.gain.setTargetAtTime(volume() * duck * (on ? 0.75 + 0.25 * Math.min(1, i) : 1), now, 0.4)
  lastIntensity = i
  if (!on || !s.run || !s.run.target) return
  // mixkeuze per blok: >= 2 min zwaar (>= 95% FTP) -> energiek, >= 5 min onder 60% -> rustig
  const t = s.run.target, tier = t.pct >= 95 && t.remaining >= 120 ? 2 : t.pct < 60 && t.remaining >= 300 ? 0 : null
  if (tier !== null && tier !== lastTier && state.tier !== tier && hasTier(tier)) {
    lastTier = tier
    start('effort')
  } else if (tier !== null) lastTier = tier
}
const hasTier = tier => tracks && tracks.some(t => tierOf(t.file) === tier)

export const getState = () => state
