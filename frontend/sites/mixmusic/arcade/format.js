// Gedeelde helpers en arcade-kleuren voor Mixmusic arcade (item 1339).
export const MOMENTS = [
  { key: 'morning', label: 'MORNING', hours: '06–12', flex: 6, color: '#ffe66d' },
  { key: 'afternoon', label: 'AFTERNOON', hours: '12–18', flex: 6, color: '#5dff9e' },
  { key: 'evening', label: 'EVENING', hours: '18–22', flex: 4, color: '#9b5cff' },
  { key: 'night', label: 'NIGHT', hours: '22–06', flex: 8, color: '#24e8ff' },
]
export const MOMENT_COLOR = Object.fromEntries(MOMENTS.map(m => [m.key, m.color]))

const GENRE_PALETTE = ['#ff2e88', '#24e8ff', '#9b5cff', '#ffe66d', '#5dff9e', '#ff9640']
export function genreColor(genres, name) {
  const idx = genres.findIndex(g => g.name === name)
  return GENRE_PALETTE[(idx < 0 ? 0 : idx) % GENRE_PALETTE.length]
}

export function ratingColor(r) {
  if (!r) return null
  if (r <= 3) return '#ff2e88'
  if (r <= 5) return '#ff9640'
  if (r <= 7) return '#ffe66d'
  return '#5dff9e'
}

export function fmtTime(sec) {
  const s = Math.floor(sec || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function fmtDuration(s) {
  if (!s || s < 1) return '–'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}
