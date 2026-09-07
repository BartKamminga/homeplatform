import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// item 1084: candidate-state queue-filter voor de scan-plan-preview - NIET
// hetzelfde als useQueueFilter.jsx (die PATCHt het echte, live filter bij
// elke toggle, en drijft de Discovery-poule-queue aan). Init vanuit de
// echte, opgeslagen filter, maar toggles hier blijven lokaal - schrijft
// nergens naar terug, puur om de shadow-run-impact te laten zien. item 1089:
// leeftijd/club/geslacht-dimensies verwijderd, alleen Niveau/Type resteren.
export function useCandidateQueueFilter() {
  const [filter, setFilter] = useState({ categories: ['Junioren'], hockey_types: ['VE'] })

  useEffect(() => {
    api.get('/api/hockey/queue-filter').then(r => setFilter({
      categories:   r.categories   || ['Junioren'],
      hockey_types: r.hockey_types || ['VE'],
    })).catch(() => {})
  }, [])

  function toggleNiveau(cat) {
    const n = filter.categories.includes(cat) ? filter.categories.filter(c => c !== cat) : [...filter.categories, cat]
    setFilter(f => ({ ...f, categories: n.length ? n : ['Junioren'] }))
  }
  function toggleHt(ht) {
    const n = filter.hockey_types.includes(ht) ? filter.hockey_types.filter(h => h !== ht) : [...filter.hockey_types, ht]
    setFilter(f => ({ ...f, hockey_types: n.length ? n : ['VE'] }))
  }

  return { filter, toggleNiveau, toggleHt }
}
