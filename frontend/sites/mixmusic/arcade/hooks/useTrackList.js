import { useState, useEffect } from 'react'
import { useUiPref } from '@core/useUiPref.js'

// Zoeken, filteren en sorteren van de tracklist (item 1339). Zelfde ui-pref-keys als classic Sidebar,
// zodat je keuzes in beide varianten gelden.
const bool = v => v === 'true'

export function useTrackList(tracks, metas, genres) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useUiPref('mm_sort', 'newest')
  const [filterGenre, setFilterGenre] = useUiPref('mm_filter_genre', null, v => (v === 'null' ? null : v))
  const [minRating, setMinRating] = useUiPref('mm_filter_rating', 0, Number)
  const [hasHearts, setHasHearts] = useUiPref('mm_filter_hearts', false, bool)
  const [showPlayCount] = useUiPref('mm_show_play_count', true, bool)
  const [showHearts] = useUiPref('mm_show_hearts', true, bool)
  const [showRating] = useUiPref('mm_show_rating', true, bool)
  const [showMoments] = useUiPref('mm_show_moments', true, bool)
  const [showExt] = useUiPref('mm_show_ext', true, bool)
  const show = { playCount: showPlayCount, hearts: showHearts, rating: showRating, moments: showMoments, ext: showExt }

  const q = search.toLowerCase()
  let list = q ? tracks.filter(t => t.name.toLowerCase().includes(q) || t.folder.toLowerCase().includes(q)) : tracks
  if (filterGenre) list = list.filter(t => metas[t.file]?.genres?.includes(filterGenre))
  if (minRating) list = list.filter(t => (metas[t.file]?.rating ?? 0) >= minRating)
  if (hasHearts) list = list.filter(t => (metas[t.file]?.heart_count ?? 0) > 0)

  const by = key => (a, b) => (metas[b.file]?.[key] ?? 0) - (metas[a.file]?.[key] ?? 0)
  if (sortBy === 'name') {
    const label = t => (metas[t.file]?.display_name || t.name).toLowerCase()
    list = [...list].sort((a, b) => label(a).localeCompare(label(b)))
  } else if (sortBy === 'rating') list = [...list].sort(by('rating'))
  else if (sortBy === 'hearts') list = [...list].sort(by('heart_count'))
  else if (sortBy === 'plays') list = [...list].sort(by('play_count'))

  const usedGenres = [...new Set(Object.values(metas).flatMap(m => m.genres || []))].filter(g => genres.some(x => x.name === g))

  // Opgeslagen genre-filter bestaat niet (meer) in deze groep: resetten.
  useEffect(() => {
    if (usedGenres.length && filterGenre && !usedGenres.includes(filterGenre)) setFilterGenre(null)
  }, [usedGenres.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const folders = [...new Set(list.map(t => t.folder).filter(Boolean))].sort()

  return {
    search, setSearch, sortBy, setSortBy, filterGenre, setFilterGenre, minRating, setMinRating,
    hasHearts, setHasHearts, show, list, usedGenres, folders,
  }
}
