import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { useQueueCmd, statBox, statNum, statLbl } from './queueShared.jsx'
import VangerStatusCard   from './vanger/VangerStatusCard.jsx'
import CmdQueueSection    from './vanger/CmdQueueSection.jsx'
import QueueFilterBar     from './vanger/QueueFilterBar.jsx'
import PouleQueueSection  from './vanger/PouleQueueSection.jsx'
import QueuesPanel        from './vanger/QueuesPanel.jsx'

function resolveHockeyType(t) {
  if (t.hockey_type === 'VE' || t.hockey_type === 'ZA') return t.hockey_type
  if (t.short_name && t.short_name[0] === 'z') return 'ZA'
  return 'VE'
}

export default function VangerTab() {
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

  // cmdAdding-state gedeeld door alle sub-secties via cmdOps
  const cmdOps = useQueueCmd({ onAdded: loadCmdQueue })

  function loadGapAnalysis() { api.get('/api/tournix/discovery/gap-analysis').then(setGapData).catch(() => {}) }

  function runGapFill() {
    setGapFilling(true)
    api.post('/api/tournix/discovery/gap-analysis/fill-queue')
      .then(r => { loadCmdQueue(); loadGapAnalysis(); setFillMsg(`Gap-fill: +${r.total} cmds (${r.added_poules} poules, ${r.added_clubs} clubs)`); setTimeout(() => setFillMsg(''), 5000) })
      .catch(() => {})
      .finally(() => setGapFilling(false))
  }

  function loadRanges() { api.get('/api/tournix/discovery/poule-ranges').then(setRangeData).catch(() => {}) }

  function loadCmdQueue() { api.get('/api/tournix/discovery/vanger/cmd-queue').then(setCmdQueue).catch(() => {}) }

  function fillCmdQueue(type, maxAgeDays) {
    setCmdFilling(type)
    const body = { type }
    if (maxAgeDays !== undefined) body.max_age_days = maxAgeDays
    api.post('/api/tournix/discovery/vanger/cmd-queue/fill', body)
      .then(r => { loadCmdQueue(); const c = r?.added ?? 0; setFillMsg(c > 0 ? `+${c} toegevoegd` : 'Niets toegevoegd (al in wachtrij of filter leeg)'); setTimeout(() => setFillMsg(''), 4000) })
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

  function runInfer() {
    setIsInferring(true); setInferResult(null)
    api.post('/api/tournix/discovery/infer-season-pending', {})
      .then(r => { setInferResult(r); loadRanges(); refreshQuiet() })
      .catch(() => {})
      .finally(() => setIsInferring(false))
  }

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

  useEffect(() => { load(); loadRanges(); loadCmdQueue(); loadGapAnalysis() }, [])

  useEffect(() => {
    function pollVanger() { api.get('/api/tournix/discovery/vanger/status').then(setVangerStatus).catch(() => {}); loadCmdQueue() }
    pollVanger()
    const t = setInterval(pollVanger, 8000)
    return () => clearInterval(t)
  }, [])

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

  const clubLogoMap   = Object.fromEntries(clubs.filter(c => c.logo_url).map(c => [c.external_id, c.logo_url]))
  const youthCount    = allTeams.filter(t => t.category_group_name === 'Junioren').length
  const veldCount     = allTeams.filter(t => resolveHockeyType(t) === 'VE').length
  const zaalCount     = allTeams.filter(t => resolveHockeyType(t) === 'ZA').length
  const detailLoaded  = clubs.filter(c => c.detail_loaded).length
  const noDetail      = clubs.length - detailLoaded

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={statBox}><span style={statNum}>{clubs.length}</span><span style={statLbl}>clubs</span></div>
        <div style={statBox}><span style={statNum}>{detailLoaded}</span><span style={statLbl}>detail geladen</span></div>
        <div style={statBox}><span style={statNum}>{youthCount}</span><span style={statLbl}>jeugdteams</span></div>
        <div style={statBox}><span style={statNum}>{veldCount}</span><span style={statLbl}>🏑 veld</span></div>
        <div style={statBox}><span style={statNum}>{zaalCount}</span><span style={statLbl}>🏒 zaal</span></div>
        <div style={{ ...statBox, borderColor: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-border)' }}>
          <span style={{ ...statNum, color: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-text)' }}>{queue.captured}/{queue.total}</span>
          <span style={statLbl}>poules {queue.target_season || '2026-2027'}</span>
        </div>
        {queue.stale > 0 && (
          <div style={statBox}><span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.stale}</span><span style={statLbl}>oud seizoen</span></div>
        )}
        {queue.waiting > 0 && (
          <div style={statBox}><span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.waiting}</span><span style={statLbl}>⏳ wacht</span></div>
        )}
        {pluginErrors.length > 0 && (
          <div style={{ ...statBox, borderColor: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => setErrOpen(true)}>
            <span style={{ ...statNum, color: 'var(--color-danger)' }}>{pluginErrors.length}</span>
            <span style={statLbl}>plugin fouten</span>
          </div>
        )}
      </div>

      {error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      <VangerStatusCard vangerStatus={vangerStatus} />

      <CmdQueueSection
        cmdQueue={cmdQueue} cmdFilling={cmdFilling} fillMsg={fillMsg}
        gapData={gapData} gapFilling={gapFilling}
        cmdOpen={cmdOpen} setCmdOpen={setCmdOpen}
        onFill={fillCmdQueue} onClear={clearCmdQueue}
        onRetryAll={retryAllFailed} onClearDone={clearDoneCmds}
        onGapFill={runGapFill} onGapRefresh={loadGapAnalysis}
        onRetrySingle={retryCmdQueue}
        cmdOps={cmdOps}
      />

      {noDetail > 0 && !loading && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 8, border: '1px dashed var(--color-border)' }}>
          ⚠️ {noDetail} clubs zonder detail — scan via de vanger op www.hockey.nl
        </div>
      )}

      <QueuesPanel
        pluginErrors={pluginErrors} setPluginErrors={setPluginErrors}
        clubScanQueue={clubScanQueue} clubLogoMap={clubLogoMap}
        competitions={competitions}
        rangeData={rangeData} inferResult={inferResult} isInferring={isInferring}
        expanded={expanded} errOpen={errOpen} setErrOpen={setErrOpen}
        toggle={toggle} onRunInfer={runInfer}
        cmdOps={cmdOps}
      />

      <QueueFilterBar
        qFilter={qFilter} queue={queue} clubs={clubs} showWaiting={showWaiting}
        onToggleNiveau={toggleNiveau} onToggleGender={toggleGender}
        onToggleHt={toggleHt} onToggleAge={toggleAge}
        onSaveFilter={saveFilter} onSetShowWaiting={setShowWaiting}
      />

      {queue.total > 0 && (
        <PouleQueueSection
          queue={queue} qFilter={qFilter} allTeams={allTeams}
          showWaiting={showWaiting} expanded={expanded}
          queueOpen={queueOpen} setQueueOpen={setQueueOpen}
          toggle={toggle} onResetPoule={resetPoule}
          cmdOps={cmdOps}
        />
      )}

      {!loading && queue.total === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Geen poule queue — teams worden geladen zodra de vanger clubs heeft gescand
        </div>
      )}
    </div>
  )
}
