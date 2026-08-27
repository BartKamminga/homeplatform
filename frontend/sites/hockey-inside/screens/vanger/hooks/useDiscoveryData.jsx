import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989): clubs/teams/queue/
// competities - de kern-discoverydata voor de Vanger-tab.
export function useDiscoveryData() {
  const [clubs,        setClubs]        = useState([])
  const [allTeams,     setAllTeams]     = useState([])
  const [queue,        setQueue]        = useState({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
  const [competitions, setCompetitions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')

  function load() {
    setLoading(true); setError('')
    Promise.all([
      api.get('/api/hockey/clubs'),
      api.get('/api/hockey/teams'),
      api.get('/api/hockey/poule-queue'),
      api.get('/api/hockey/competitions'),
    ]).then(([clubsRes, teamsRes, queueRes, compsRes]) => {
      setClubs(clubsRes.clubs || [])
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setCompetitions(compsRes.competitions || [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  function resetPoule(poule_id) {
    api.delete('/api/hockey/poules/' + poule_id).then(() =>
      setQueue(q => {
        const poules  = q.poules.map(x => x.poule_id === poule_id ? { ...x, captured: false, stale: false } : x)
        const n_cap   = poules.filter(x => x.captured && !x.stale).length
        const n_stale = poules.filter(x => x.stale).length
        return { ...q, poules, captured: n_cap, stale: n_stale, missing: q.total - n_cap - n_stale }
      })
    )
  }

  useEffect(() => { load() }, [])

  return { clubs, setClubs, allTeams, queue, setQueue, competitions, loading, error, load, resetPoule }
}
