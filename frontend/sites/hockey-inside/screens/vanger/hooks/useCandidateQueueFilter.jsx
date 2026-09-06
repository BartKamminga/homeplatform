import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// item 1084: candidate-state queue-filter voor de scan-plan-preview - NIET
// hetzelfde als useQueueFilter.jsx (die PATCHt het echte, live filter bij
// elke toggle, en drijft de Discovery-poule-queue aan). Init vanuit de
// echte, opgeslagen filter, maar toggles hier blijven lokaal - schrijft
// nergens naar terug, puur om de shadow-run-impact te laten zien.
export function useCandidateQueueFilter() {
  const [filter, setFilter] = useState({
    age_groups: [], club_external_id: null, categories: ['Junioren'], hockey_types: ['VE'], genders: [],
  })

  useEffect(() => {
    api.get('/api/hockey/queue-filter').then(r => setFilter({
      age_groups:       r.age_groups       || [],
      club_external_id: r.club_external_id || null,
      categories:       r.categories       || ['Junioren'],
      hockey_types:     r.hockey_types     || ['VE'],
      genders:          r.genders          || [],
    })).catch(() => {})
  }, [])

  function toggleNiveau(cat) {
    const n = filter.categories.includes(cat) ? filter.categories.filter(c => c !== cat) : [...filter.categories, cat]
    setFilter(f => ({ ...f, categories: n.length ? n : ['Junioren'] }))
  }
  function toggleGender(g) {
    const n = filter.genders.includes(g) ? filter.genders.filter(x => x !== g) : [...filter.genders, g]
    setFilter(f => ({ ...f, genders: n }))
  }
  function toggleHt(ht) {
    const n = filter.hockey_types.includes(ht) ? filter.hockey_types.filter(h => h !== ht) : [...filter.hockey_types, ht]
    setFilter(f => ({ ...f, hockey_types: n.length ? n : ['VE'] }))
  }
  function toggleAge(ag) {
    const n = filter.age_groups.includes(ag) ? filter.age_groups.filter(a => a !== ag) : [...filter.age_groups, ag]
    setFilter(f => ({ ...f, age_groups: n }))
  }
  function setClub(id) { setFilter(f => ({ ...f, club_external_id: id || null })) }

  return { filter, toggleNiveau, toggleGender, toggleHt, toggleAge, setClub }
}
