import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989).
// setQueue: setter uit useDiscoveryData - een gewijzigd filter ververst de
// poule-queue meteen.
export function useQueueFilter(setQueue) {
  const [qFilter, setQFilter] = useState({
    age_groups: [], club_external_id: null, categories: ['Junioren'], hockey_types: ['VE'], genders: [],
  })
  const [showWaiting, setShowWaiting] = useState(() => {
    try { return localStorage.getItem('disc_show_waiting') !== 'false' } catch { return true }
  })

  useEffect(() => {
    api.get('/api/hockey/queue-filter').then(r => setQFilter({
      age_groups:       r.age_groups       || [],
      club_external_id: r.club_external_id || null,
      categories:       r.categories       || ['Junioren'],
      hockey_types:     r.hockey_types     || ['VE'],
      genders:          r.genders          || [],
    })).catch(() => {})
  }, [])

  function saveFilter(next) {
    setQFilter(next)
    api.patch('/api/hockey/queue-filter', {
      age_groups:       next.age_groups,
      club_external_id: next.club_external_id || null,
      categories:       next.categories?.length   ? next.categories   : ['Junioren'],
      hockey_types:     next.hockey_types?.length ? next.hockey_types : ['VE'],
      genders:          next.genders || [],
    }).then(() => api.get('/api/hockey/poule-queue'))
      .then(q => setQueue(q)).catch(() => {})
  }

  function toggleAge(ag)     { saveFilter({ ...qFilter, age_groups: qFilter.age_groups.includes(ag) ? qFilter.age_groups.filter(a => a !== ag) : [...qFilter.age_groups, ag] }) }
  function toggleNiveau(cat) { const n = qFilter.categories.includes(cat) ? qFilter.categories.filter(c => c !== cat) : [...qFilter.categories, cat]; saveFilter({ ...qFilter, categories: n.length ? n : ['Junioren'] }) }
  function toggleGender(g)   { const n = qFilter.genders.includes(g) ? qFilter.genders.filter(x => x !== g) : [...qFilter.genders, g]; saveFilter({ ...qFilter, genders: n }) }
  function toggleHt(ht)      { const n = qFilter.hockey_types.includes(ht) ? qFilter.hockey_types.filter(h => h !== ht) : [...qFilter.hockey_types, ht]; saveFilter({ ...qFilter, hockey_types: n.length ? n : ['VE'] }) }

  return { qFilter, setQFilter, showWaiting, setShowWaiting, saveFilter, toggleAge, toggleNiveau, toggleGender, toggleHt }
}
