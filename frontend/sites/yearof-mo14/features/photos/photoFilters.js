// Filteren, sorteren en groeperen voor de PhotoManager (item 1213) - pure
// functies, geen React. ctx = { entryTitle(ref), entryDate(ref), playerName(id), players }

export const QUICK_FILTERS = [
  { key: 'review', label: 'Te beoordelen', test: p => p.status !== 'published' },
  { key: 'untagged', label: 'Zonder tags', test: p => p.status === 'published' && p.player_ids.length === 0 },
  { key: 'all', label: 'Alles', test: () => true },
]

export const SORTS = [
  { key: 'newest', label: 'Nieuwste upload' },
  { key: 'oldest', label: 'Oudste upload' },
  { key: 'matchDate', label: 'Wedstrijddatum' },
  { key: 'likes', label: 'Meeste likes' },
  { key: 'unprocessed', label: 'Onbewerkt eerst' },
]

export const GROUPINGS = [
  { key: 'flat', label: 'Geen (alles in 1 grid)' },
  { key: 'match', label: 'Per wedstrijd' },
  { key: 'status', label: 'Per status' },
  { key: 'player', label: 'Per speelster' },
  { key: 'source', label: 'Per uploader' },
  { key: 'report', label: 'Per bericht/verslag' },
]

export const PHOTO_TYPES = [
  { key: 'actie', label: 'Actie' },
  { key: 'team', label: 'Team' },
  { key: 'sfeer', label: 'Sfeer' },
]

export const DEFAULT_FILTERS = {
  quick: 'review', search: '', status: '', matchRef: '', playerId: '', type: '', media: '',
  highlight: '', favorite: '', attached: '', source: '', period: '',
}

const uploadedAt = p => new Date(/[zZ]$/.test(p.created_at) ? p.created_at : `${p.created_at}Z`)

// Alles behalve het snelfilter - zo kunnen de chips hun aantallen tonen
// binnen de overige filters.
function matchesFilters(p, f, ctx) {
  if (f.status === 'concept' && p.status === 'published') return false
  if (f.status === 'published' && p.status !== 'published') return false
  if (f.matchRef === 'none' && p.match_ref) return false
  if (f.matchRef && f.matchRef !== 'none' && p.match_ref !== f.matchRef) return false
  if (f.playerId === 'none' && p.player_ids.length > 0) return false
  if (f.playerId && f.playerId !== 'none' && !p.player_ids.includes(f.playerId)) return false
  if (f.type && p.photo_type !== f.type) return false
  if (f.media && p.media_type !== f.media) return false
  if (f.highlight === 'yes' && !p.match_highlight) return false
  if (f.highlight === 'no' && p.match_highlight) return false
  if (f.favorite === 'yes' && !(p.favorite_player_ids || []).length) return false
  if (f.attached === 'report' && !p.report_id) return false
  if (f.attached === 'loose' && p.report_id) return false
  if (f.attached === 'general' && (!p.report_id || p.match_ref)) return false // algemeen bericht = verslag zonder wedstrijd
  if (f.source && p.source?.kind !== f.source) return false
  if (f.period && (Date.now() - uploadedAt(p)) > Number(f.period) * 86400000) return false
  if (f.search) {
    const haystack = [
      ctx.entryTitle(p.match_ref), p.caption, p.source?.label, p.report?.title,
      ...p.player_ids.map(ctx.playerName),
    ].filter(Boolean).join(' ').toLowerCase()
    if (!haystack.includes(f.search.toLowerCase())) return false
  }
  return true
}

export function filterPhotos(photos, f, ctx) {
  const quick = QUICK_FILTERS.find(q => q.key === f.quick) || QUICK_FILTERS[2]
  return photos.filter(p => quick.test(p) && matchesFilters(p, f, ctx))
}

export function quickCounts(photos, f, ctx) {
  const base = photos.filter(p => matchesFilters(p, f, ctx))
  return Object.fromEntries(QUICK_FILTERS.map(q => [q.key, base.filter(q.test).length]))
}

const unprocessedScore = p => (p.status !== 'published' ? 2 : 0) + (p.player_ids.length === 0 ? 1 : 0)

export function sortPhotos(list, sort, ctx) {
  const byDate = (a, b) => uploadedAt(b) - uploadedAt(a)
  const sorted = [...list]
  if (sort === 'oldest') return sorted.sort((a, b) => -byDate(a, b))
  if (sort === 'likes') return sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0) || byDate(a, b))
  if (sort === 'unprocessed') return sorted.sort((a, b) => unprocessedScore(b) - unprocessedScore(a) || byDate(a, b))
  if (sort === 'matchDate') {
    return sorted.sort((a, b) => (ctx.entryDate(b.match_ref) || '').localeCompare(ctx.entryDate(a.match_ref) || '') || byDate(a, b))
  }
  return sorted.sort(byDate)
}

// [{ key, label, photos }] - de volgorde van de foto's binnen een groep
// blijft die van sortPhotos. Bij "per speelster" kan een foto in meerdere
// groepen staan.
export function groupPhotos(list, grouping, ctx) {
  if (grouping === 'flat') return [{ key: 'all', label: null, photos: list }]
  const groups = new Map()
  const add = (key, label, photo, order = 0) => {
    if (!groups.has(key)) groups.set(key, { key, label, order, photos: [] })
    groups.get(key).photos.push(photo)
  }
  for (const p of list) {
    if (grouping === 'match') {
      add(p.match_ref || 'none', p.match_ref ? ctx.entryTitle(p.match_ref) : 'Zonder wedstrijd (algemene berichten)', p,
        p.match_ref ? ctx.entryDate(p.match_ref) || '' : '0')
    } else if (grouping === 'status') {
      const live = p.status === 'published'
      add(live ? 'live' : 'concept', live ? 'Live' : 'Te beoordelen (concept)', p, live ? '0' : '1')
    } else if (grouping === 'player') {
      if (p.player_ids.length === 0) add('none', 'Niet getagd', p, -1)
      for (const id of p.player_ids) {
        add(id, ctx.playerName(id), p, ctx.players.findIndex(pl => pl.id === id))
      }
    } else if (grouping === 'source') {
      add(p.source?.label || '?', p.source?.label || 'Onbekend', p, p.source?.label || '')
    } else if (grouping === 'report') {
      if (!p.report_id) add('loose', 'Los (fotoblok van een wedstrijd)', p, '0')
      else add(p.report_id, `${p.match_ref ? ctx.entryTitle(p.match_ref) : 'Algemeen bericht'}: ${p.report?.title || 'zonder titel'}`, p,
        p.match_ref ? ctx.entryDate(p.match_ref) || '1' : '9') // algemene berichten bovenaan
    }
  }
  const out = [...groups.values()]
  if (grouping === 'player') return out.sort((a, b) => a.order - b.order)
  if (grouping === 'source') return out.sort((a, b) => String(a.order).localeCompare(String(b.order)))
  return out.sort((a, b) => String(b.order).localeCompare(String(a.order)))
}
