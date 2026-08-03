import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { useQueueCmd } from '../queueShared.jsx'

export function useVangerState() {
  const [clubs,         setClubs]         = useState([])
  const [allTeams,      setAllTeams]      = useState([])
  const [queue,         setQueue]         = useState({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
  const [competitions,  setCompetitions]  = useState([])
  const [clubScanQueue, setClubScanQueue] = useState({ total: 0, clubs: [] })
  const [pluginErrors,  setPluginErrors]  = useState([])
  const [vangerStatus,  setVangerStatus]  = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [expanded,      setExpanded]      = useState(new Set())
  const [errOpen,       setErrOpen]       = useState(false)
  const [queueOpen,     setQueueOpen]     = useState(true)
  const [qFilter,       setQFilter]       = useState({ age_groups: [], club_external_id: null, categories: ['Junioren'], hockey_types: ['VE'], genders: [] })
  const [showWaiting,   setShowWaiting]   = useState(() => {
    try { return localStorage.getItem('disc_show_waiting') !== 'false' } catch { return true }
  })
  const [rangeData,     setRangeData]     = useState(null)
  const [isInferring,   setIsInferring]   = useState(false)
  const [inferResult,   setInferResult]   = useState(null)
  const [cmdQueue,      setCmdQueue]      = useState(null)
  const [cmdFilling,    setCmdFilling]    = useState(null)
  const [cmdOpen,       setCmdOpen]       = useState(true)
  const [fillMsg,       setFillMsg]       = useState('')
  const [gapData,       setGapData]       = useState(null)
  const [gapFilling,    setGapFilling]    = useState(false)

  function loadCmdQueue()    { api.get('/api/tournix/discovery/vanger/cmd-queue').then(setCmdQueue).catch(() => {}) }
  function loadGapAnalysis() { api.get('/api/tournix/discovery/gap-analysis').then(setGapData).catch(() => {}) }
  function loadRanges()      { api.get('/api/tournix/discovery/poule-ranges').then(setRangeData).catch(() => {}) }

  const cmdOps = useQueueCmd({ onAdded: loadCmdQueue })

  function load() {
    setLoading(true); setError('')
    Promise.all([
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/poule-queue'),
      api.get('/api/tournix/discovery/competitions'),
      api.get('/api/tournix/discovery/plugin-errors?limit=30'),
      api.get('/api/tournix/discovery/queue-filter'),
      api.get('/api/tournix/discovery/club-scan-queue'),
    ]).then(([clubsRes, teamsRes, queueRes, compsRes, errRes, filterRes, clubScanRes]) => {
      setClubs(clubsRes.clubs || [])
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setCompetitions(compsRes.competitions || [])
      setPluginErrors(errRes.errors || [])
      setQFilter({
        age_groups:       filterRes.age_groups       || [],
        club_external_id: filterRes.club_external_id || null,
        categories:       filterRes.categories       || ['Junioren'],
        hockey_types:     filterRes.hockey_types     || ['VE'],
        genders:          filterRes.genders          || [],
      })
      setClubScanQueue(clubScanRes)
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  function refreshQuiet() {
    Promise.all([
      api.get('/api/tournix/discovery/poule-queue'),
      api.get('/api/tournix/discovery/club-scan-queue'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/competitions'),
    ]).then(([queueRes, clubScanRes, teamsRes, compsRes]) => {
      setQueue(queueRes); setClubScanQueue(clubScanRes)
      setAllTeams(teamsRes.teams || []); setCompetitions(compsRes.competitions || [])
    }).catch(() => {})
  }

  function saveFilter(next) {
    setQFilter(next)
    api.patch('/api/tournix/discovery/queue-filter', {
      age_groups:       next.age_groups,
      club_external_id: next.club_external_id || null,
      categories:       next.categories?.length   ? next.categories   : ['Junioren'],
      hockey_types:     next.hockey_types?.length ? next.hockey_types : ['VE'],
      genders:          next.genders || [],
    }).then(() => api.get('/api/tournix/discovery/poule-queue'))
      .then(q => setQueue(q)).catch(() => {})
  }

  function toggleAge(ag)    { saveFilter({ ...qFilter, age_groups: qFilter.age_groups.includes(ag) ? qFilter.age_groups.filter(a => a !== ag) : [...qFilter.age_groups, ag] }) }
  function toggleNiveau(cat) { const n = qFilter.categories.includes(cat) ? qFilter.categories.filter(c => c !== cat) : [...qFilter.categories, cat]; saveFilter({ ...qFilter, categories: n.length ? n : ['Junioren'] }) }
  function toggleGender(g)  { const n = qFilter.genders.includes(g) ? qFilter.genders.filter(x => x !== g) : [...qFilter.genders, g]; saveFilter({ ...qFilter, genders: n }) }
  function toggleHt(ht)     { const n = qFilter.hockey_types.includes(ht) ? qFilter.hockey_types.filter(h => h !== ht) : [...qFilter.hockey_types, ht]; saveFilter({ ...qFilter, hockey_types: n.length ? n : ['VE'] }) }

  function toggle(extId) {
    setExpanded(prev => { const next = new Set(prev); next.has(extId) ? next.delete(extId) : next.add(extId); return next })
  }

  function resetPoule(poule_id) {
    api.delete('/api/tournix/discovery/poules/' + poule_id).then(() =>
      setQueue(q => {
        const poules  = q.poules.map(x => x.poule_id === poule_id ? { ...x, captured: false, stale: false } : x)
        const n_cap   = poules.filter(x => x.captured && !x.stale).length
        const n_stale = poules.filter(x => x.stale).length
        return { ...q, poules, captured: n_cap, stale: n_stale, missing: q.total - n_cap - n_stale }
      })
    )
  }

  function fillCmdQueue(type, maxAgeDays) {
    setCmdFilling(type)
    const body = { type }
    if (maxAgeDays !== undefined) body.max_age_days = maxAgeDays
    api.post('/api/tournix/discovery/vanger/cmd-queue/fill', body)
      .then(r => {
        loadCmdQueue()
        const c = r?.added ?? 0
        let msg
        if (c > 0) {
          msg = `+${c} toegevoegd`
        } else if (r?.stale_skip > 0) {
          msg = `${r.stale_skip} ploegen zitten in oud-seizoenpoules — gebruik eerst 'Clubs vullen' om nieuwe te ontdekken`
        } else {
          msg = 'Niets toegevoegd (al in wachtrij of filter leeg)'
        }
        setFillMsg(msg)
        setTimeout(() => setFillMsg(''), 6000)
      })
      .catch(() => {})
      .finally(() => setCmdFilling(null))
  }

  function clearCmdQueue() {
    if (!window.confirm('Alle pending cmds wissen?')) return
    api.delete('/api/tournix/discovery/vanger/cmd-queue').then(() => loadCmdQueue()).catch(() => {})
  }

  function retryCmdQueue(id) {
    api.post('/api/tournix/discovery/vanger/cmd-queue/' + id + '/retry', {}).then(() => loadCmdQueue()).catch(() => {})
  }

  function retryAllFailed() {
    const failed = cmdQueue?.recent?.filter(c => c.status === 'failed') || []
    if (!failed.length) return
    Promise.all(failed.map(c => api.post('/api/tournix/discovery/vanger/cmd-queue/' + c.id + '/retry', {})))
      .then(() => loadCmdQueue()).catch(() => {})
  }

  function clearDoneCmds() {
    api.delete('/api/tournix/discovery/vanger/cmd-queue?scope=done').then(() => loadCmdQueue()).catch(() => {})
  }

  function runGapFill() {
    setGapFilling(true)
    api.post('/api/tournix/discovery/gap-analysis/fill-queue')
      .then(r => { loadCmdQueue(); loadGapAnalysis(); setFillMsg(`Gap-fill: +${r.total} cmds (${r.added_poules} poules, ${r.added_clubs} clubs)`); setTimeout(() => setFillMsg(''), 5000) })
      .catch(() => {})
      .finally(() => setGapFilling(false))
  }

  function runInfer() {
    setIsInferring(true); setInferResult(null)
    api.post('/api/tournix/discovery/infer-season-pending', {})
      .then(r => { setInferResult(r); loadRanges(); refreshQuiet() })
      .catch(() => {})
      .finally(() => setIsInferring(false))
  }

  useEffect(() => { load(); loadRanges(); loadCmdQueue(); loadGapAnalysis() }, [])

  useEffect(() => {
    function pollVanger() { api.get('/api/tournix/discovery/vanger/status').then(setVangerStatus).catch(() => {}); loadCmdQueue() }
    pollVanger()
    const t = setInterval(pollVanger, 8000)
    return () => clearInterval(t)
  }, [])

  return {
    clubs, setClubs,
    allTeams,
    queue,
    competitions,
    clubScanQueue,
    pluginErrors, setPluginErrors,
    vangerStatus,
    loading, error,
    expanded, errOpen, setErrOpen,
    queueOpen, setQueueOpen,
    qFilter,
    showWaiting, setShowWaiting,
    rangeData,
    isInferring, inferResult,
    cmdQueue,
    cmdFilling,
    cmdOpen, setCmdOpen,
    fillMsg,
    gapData, gapFilling,
    cmdOps,
    // functions
    load, loadCmdQueue, loadGapAnalysis, loadRanges,
    fillCmdQueue, clearCmdQueue, retryCmdQueue, retryAllFailed, clearDoneCmds,
    saveFilter, toggleAge, toggleNiveau, toggleGender, toggleHt,
    toggle, resetPoule, runGapFill, runInfer,
  }
}
