// Gedeelde constanten en pure hulpfuncties voor BeatCrades

export const FORMATS = ['flac', 'aac', 'mp3', 'wav']

// Display-label per formaat (intern 'aac' → gebruiker ziet 'M4A')
export const FMT_LABEL = { flac: 'FLAC', aac: 'M4A', mp3: 'MP3', wav: 'WAV' }

export const ST = {
  no_job:      { label: 'Leeg',  cls: 'empty' },
  queued:      { label: 'Wacht', cls: 'queued' },
  downloading: { label: 'Bezig', cls: 'active' },
  done:        { label: 'Klaar', cls: 'done' },
  error:       { label: 'Fout',  cls: 'error' },
}

export const SRC_ICON = { beatport: '🎵', youtube: '▶️', soundcloud: '☁️', auto: '🌐' }

// Stall-drempel per source (ms); YouTube/SoundCloud hebben langere conversietijd
export const STALL_MS = {
  beatport:   3 * 60 * 1000,
  youtube:    8 * 60 * 1000,
  soundcloud: 8 * 60 * 1000,
  auto:       8 * 60 * 1000,
}

const _BP_TYPES = new Set([
  'playlist','playlists','release','releases','track','tracks',
  'artist','artists','chart','charts','label','labels','mix','mixes',
])

export function detectSrc(url) {
  const u = (url || '').toLowerCase()
  if (u.includes('beatport.com') || u.includes('beatsource.com')) return 'beatport'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('soundcloud.com')) return 'soundcloud'
  return 'auto'
}

export function slugFromBeatportUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const typeIdx = parts.findIndex(p => _BP_TYPES.has(p.toLowerCase()))
    if (typeIdx !== -1 && typeIdx + 1 < parts.length) {
      const slug = parts[typeIdx + 1]
      if (!/^\d+$/.test(slug))
        return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
  } catch {}
  return null
}

export function parseProgress(log) {
  if (!log) return { done: 0, total: null }
  let done = 0, total = null
  for (const line of log.split('\n')) {
    // yt-dlp: "[download] Downloading item 5 of 20"
    const m = line.match(/Downloading item (\d+) of (\d+)/i)
           || line.match(/Downloading track (\d+)[/ ](\d+)/i)
           || line.match(/\[(\d+)\/(\d+)\]/)
           || line.match(/item\s+(\d+)\s+of\s+(\d+)/i)
    if (m) { done = parseInt(m[1]); total = parseInt(m[2]) }
  }
  if (!total) {
    // yt-dlp: tel Destination:-regels (per track)
    // beatportdl: tel "Finished downloading"-regels (per track)
    done = (log.match(/Destination:/g) || []).length
        || (log.match(/^Finished downloading /gm) || []).length
  }
  return { done, total }
}

export function lastLine(log) {
  if (!log) return ''
  return log.split('\n').filter(Boolean).at(-1) || ''
}

export function parseCurrentTrack(log) {
  if (!log) return null
  let name = null
  for (const line of log.split('\n')) {
    // yt-dlp: "Destination: /path/Track Name.flac"
    let m = line.match(/Destination:\s*(.+\.(?:flac|mp3|m4a|opus|ogg|wav|webm|mkv))\s*$/i)
    if (m) { name = m[1].split(/[/\\]/).pop().replace(/\.[^.]+$/, ''); continue }
    // yt-dlp: [ExtractAudio] Destination: "Track Name"
    m = line.match(/\[(?:Metadata|Merger|ExtractAudio)\][^"]*"(.+?)"/i)
    if (m) { name = m[1].replace(/\.[^.]+$/, ''); continue }
    // beatportdl: "Downloading Track Name (Mix Name) [FLAC]"
    m = line.match(/^(?:Downloading|Finished downloading)\s+(.+?)\s+\([^)]*\)\s+\[(?:FLAC|AAC|MP3)/i)
    if (m) { name = m[1]; continue }
  }
  return name
}

// Behandel server-timestamp als UTC (backend stuurt naive datetime zonder 'Z')
export function utcDate(ts) {
  if (!ts) return null
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z')
}

export function todayName() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

export function allCradesFrom(tree) {
  return [
    ...tree.crades,
    ...tree.racks.flatMap(r => r.crades),
    ...tree.sections.flatMap(s => s.racks.flatMap(r => r.crades)),
  ]
}
