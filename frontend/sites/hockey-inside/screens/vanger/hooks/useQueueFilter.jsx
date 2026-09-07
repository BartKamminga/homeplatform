import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989).
// setQueue: setter uit useDiscoveryData - een gewijzigd filter ververst de
// poule-queue meteen. item 1089: leeftijd/club/geslacht-dimensies
// verwijderd, alleen Niveau/Type resteren.
export function useQueueFilter(setQueue) {
  const [qFilter, setQFilter] = useState({ categories: ['Junioren'], hockey_types: ['VE'] })
  const [showWaiting, setShowWaiting] = useState(() => {
    try { return localStorage.getItem('disc_show_waiting') !== 'false' } catch { return true }
  })

  useEffect(() => {
    api.get('/api/hockey/queue-filter').then(r => setQFilter({
      categories:   r.categories   || ['Junioren'],
      hockey_types: r.hockey_types || ['VE'],
    })).catch(() => {})
  }, [])

  function saveFilter(next) {
    setQFilter(next)
    api.patch('/api/hockey/queue-filter', {
      categories:   next.categories?.length   ? next.categories   : ['Junioren'],
      hockey_types: next.hockey_types?.length ? next.hockey_types : ['VE'],
    }).then(() => api.get('/api/hockey/poule-queue'))
      .then(q => setQueue(q)).catch(() => {})
  }

  function toggleNiveau(cat) { const n = qFilter.categories.includes(cat) ? qFilter.categories.filter(c => c !== cat) : [...qFilter.categories, cat]; saveFilter({ ...qFilter, categories: n.length ? n : ['Junioren'] }) }
  function toggleHt(ht)      { const n = qFilter.hockey_types.includes(ht) ? qFilter.hockey_types.filter(h => h !== ht) : [...qFilter.hockey_types, ht]; saveFilter({ ...qFilter, hockey_types: n.length ? n : ['VE'] }) }

  return { qFilter, setQFilter, showWaiting, setShowWaiting, saveFilter, toggleNiveau, toggleHt }
}
