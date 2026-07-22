import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { ghostBtn } from './styles.js'

const statBox = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, minWidth: 60 }
const statNum = { fontSize: 20, fontWeight: 700, lineHeight: 1 }
const statLbl = { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, textAlign: 'center' }

const VARIANT = {
  ok:      { bg: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', fg: 'var(--color-success)', border: 'var(--color-success)' },
  partial: { bg: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))', fg: 'var(--color-warning)', border: 'var(--color-warning)' },
  muted:   { bg: 'var(--color-surface)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' },
}
function pill(variant) {
  const c = VARIANT[variant] || VARIANT.muted
  return { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
}

function fmtDuration(ms) {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

function fmtBytes(b) {
  if (!b) return null
  if (b < 1024) return b + 'B'
  if (b < 1024 * 1024) return Math.round(b / 1024) + 'kB'
  return (b / (1024 * 1024)).toFixed(1) + 'MB'
}

function makeCmdConclusion(cmd, summary) {
  if (!summary) return null
  if (summary.parse_failed) return '⚠ Parse mislukt — raw data onleesbaar'
  if (cmd.cmd_type === 'get_poule') {
    const { teams = 0, standings = 0, matches_total = 0, matches_played = 0, competition, season } = summary
    if (standings === 0 && matches_total === 0) return `Poule leeg – nog geen indeling${season ? ' · ' + season : ''}`
    const base = `${teams || standings} teams`
    if (matches_total === 0) return base + ' · geen wedstrijdschema'
    if (matches_played === 0) return base + ` · ${matches_total} wedstrijden · nog niet gespeeld`
    const pct = Math.round((matches_played / matches_total) * 100)
    return base + ` · ${matches_played}/${matches_total} gespeeld (${pct}%)`
  }
  if (cmd.cmd_type === 'scan_club') {
    const { teams_found = 0, teams_added = 0 } = summary
    const added = teams_added > 0 ? ` · +${teams_added} nieuw` : ''
    return `${teams_found} teams gevonden${added}`
  }
  return null
}

const TYPE_BADGE = {
  get_poule: { label: 'poule', color: '#1565c0', bg: '#dbeafe', darkBg: '#1e3a5f', darkColor: '#93c5fd' },
  scan_club: { label: 'club',  color: '#15803d', bg: '#dcfce7', darkBg: '#14532d', darkColor: '#86efac' },
}

const CAT_ORDER = ['Junioren', 'Meisjes', 'Senioren', 'Heren', 'Dames', "Mini's", 'Recreanten']
function sortCats(cats) {
  return [...cats].sort((a, b) => {
    const ai = CAT_ORDER.indexOf(a), bi = CAT_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

const HT_LABEL = { VE: '🏑 Veldhockey', ZA: '🏒 Zaalhockey' }
const HT_ORDER = ['VE', 'ZA']

function resolveHockeyType(t) {
  if (t.hockey_type === 'VE' || t.hockey_type === 'ZA') return t.hockey_type
  if (t.short_name && t.short_name[0] === 'z') return 'ZA'
  return 'VE'
}

const HT_BADGE = { VE: { bg: '#e8f5e9', fg: '#2e7d32', dark: '#1b5e20' }, ZA: { bg: '#e3f2fd', fg: '#1565c0', dark: '#0d47a1' } }

export default function DiscoveryTab({ view = 'vanger' }) {
  const [clubs,          setClubs]          = useState([])
  const [allTeams,       setAllTeams]       = useState([])
  const [queue,          setQueue]          = useState({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
  const [competitions,   setCompetitions]   = useState([])
  const [capturedPoules,  setCapturedPoules]  = useState([])
  const [clubScanQueue,   setClubScanQueue]   = useState({ total: 0, clubs: [] })
  const [pluginErrors, setPluginErrors] = useState([])
  const [vangerStatus, setVangerStatus] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [expanded,     setExpanded]     = useState(new Set())
  const [compOpen,     setCompOpen]     = useState(false)
  const [errOpen,      setErrOpen]      = useState(false)
  const [queueOpen,    setQueueOpen]    = useState(true)
  const [qFilter,      setQFilter]      = useState({ age_groups: [], club_external_id: null, categories: ['Junioren'], hockey_types: ['VE'], genders: [] })
  const [showWaiting,  setShowWaiting]  = useState(() => {
    try { return localStorage.getItem('disc_show_waiting') !== 'false' } catch { return true }
  })
  const [autoRefresh,  setAutoRefresh]  = useState(() => {
    try { return localStorage.getItem('disc_auto_refresh') === 'true' } catch { return false }
  })
  const [rangeData,    setRangeData]    = useState(null)
  const [isInferring,  setIsInferring]  = useState(false)
  const [inferResult,  setInferResult]  = useState(null)
  const [cmdQueue,     setCmdQueue]     = useState(null)
  const [cmdFilling,   setCmdFilling]   = useState(null)  // 'poules'|'clubs'|null
  const [cmdOpen,      setCmdOpen]      = useState(true)
  const [cmdAdding,    setCmdAdding]    = useState({})    // {key: 'adding'|'added'|'exists'}

  function loadRanges() {
    api.get('/api/tournix/discovery/poule-ranges').then(setRangeData).catch(() => {})
  }

  function loadCmdQueue() {
    api.get('/api/tournix/discovery/vanger/cmd-queue').then(setCmdQueue).catch(() => {})
  }

  function fillCmdQueue(type) {
    setCmdFilling(type)
    api.post('/api/tournix/discovery/vanger/cmd-queue/fill', { type })
      .then(() => loadCmdQueue())
      .catch(() => {})
      .finally(() => setCmdFilling(null))
  }

  function clearCmdQueue() {
    if (!window.confirm('Alle pending cmds wissen?')) return
    api.delete('/api/tournix/discovery/vanger/cmd-queue')
      .then(() => loadCmdQueue())
      .catch(() => {})
  }

  function retryCmdQueue(id) {
    api.post('/api/tournix/discovery/vanger/cmd-queue/' + id + '/retry', {})
      .then(() => loadCmdQueue())
      .catch(() => {})
  }

  function retryAllFailed() {
    const failed = cmdQueue?.recent?.filter(c => c.status === 'failed') || []
    if (!failed.length) return
    Promise.all(failed.map(c => api.post('/api/tournix/discovery/vanger/cmd-queue/' + c.id + '/retry', {})))
      .then(() => loadCmdQueue())
      .catch(() => {})
  }

  function clearDoneCmds() {
    api.delete('/api/tournix/discovery/vanger/cmd-queue?scope=done')
      .then(() => loadCmdQueue())
      .catch(() => {})
  }

  function addSingleCmd(type, params) {
    const key = type + '_' + (params.poule_id || params.external_id)
    setCmdAdding(prev => ({ ...prev, [key]: 'adding' }))
    api.post('/api/tournix/discovery/vanger/cmd-queue/add', { cmd_type: type, params })
      .then(r => {
        setCmdAdding(prev => ({ ...prev, [key]: r.added ? 'added' : 'exists' }))
        loadCmdQueue()
        setTimeout(() => setCmdAdding(prev => { const n = { ...prev }; delete n[key]; return n }), 2000)
      })
      .catch(() => setCmdAdding(prev => { const n = { ...prev }; delete n[key]; return n }))
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
      api.get('/api/tournix/discovery/competitions?season=2026-2027'),
      api.get('/api/tournix/discovery/plugin-errors?limit=30'),
      api.get('/api/tournix/discovery/queue-filter'),
      api.get('/api/tournix/discovery/poules?season=2026-2027'),
      api.get('/api/tournix/discovery/club-scan-queue'),
    ]).then(([clubsRes, teamsRes, queueRes, compsRes, errRes, filterRes, poulesRes, clubScanRes]) => {
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
      setCapturedPoules(poulesRes.poules || [])
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
      .then(q => setQueue(q))
      .catch(() => {})
  }

  function toggleAge(ag) {
    saveFilter({
      ...qFilter,
      age_groups: qFilter.age_groups.includes(ag)
        ? qFilter.age_groups.filter(a => a !== ag)
        : [...qFilter.age_groups, ag],
    })
  }

  function toggleNiveau(cat) {
    const next = qFilter.categories.includes(cat)
      ? qFilter.categories.filter(c => c !== cat)
      : [...qFilter.categories, cat]
    saveFilter({ ...qFilter, categories: next.length ? next : ['Junioren'] })
  }

  function toggleGender(g) {
    const next = qFilter.genders.includes(g)
      ? qFilter.genders.filter(x => x !== g)
      : [...qFilter.genders, g]
    saveFilter({ ...qFilter, genders: next })
  }

  function toggleHt(ht) {
    const next = qFilter.hockey_types.includes(ht)
      ? qFilter.hockey_types.filter(h => h !== ht)
      : [...qFilter.hockey_types, ht]
    saveFilter({ ...qFilter, hockey_types: next.length ? next : ['VE'] })
  }

  function refreshQuiet() {
    Promise.all([
      api.get('/api/tournix/discovery/poule-queue'),
      api.get('/api/tournix/discovery/club-scan-queue'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/poules?season=2026-2027'),
    ]).then(([queueRes, clubScanRes, teamsRes, poulesRes]) => {
      setQueue(queueRes)
      setClubScanQueue(clubScanRes)
      setAllTeams(teamsRes.teams || [])
      setCapturedPoules(poulesRes.poules || [])
    }).catch(() => {})
  }

  useEffect(() => { load(); loadRanges(); loadCmdQueue() }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(refreshQuiet, 10000)
    return () => clearInterval(t)
  }, [autoRefresh])

  useEffect(() => {
    if (view !== 'vanger') return
    function pollVanger() {
      api.get('/api/tournix/discovery/vanger/status').then(setVangerStatus).catch(() => {})
      loadCmdQueue()
    }
    pollVanger()
    const t = setInterval(pollVanger, 8000)
    return () => clearInterval(t)
  }, [view])

  function toggle(extId) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(extId) ? next.delete(extId) : next.add(extId)
      return next
    })
  }

  const clubMap = {}
  for (const c of clubs) clubMap[c.external_id] = c.friendly_name || c.name

  const teamsByClub = {}
  for (const t of allTeams) {
    if (!teamsByClub[t.club_external_id]) teamsByClub[t.club_external_id] = []
    teamsByClub[t.club_external_id].push(t)
  }

  const queueByPouleId = {}
  for (const p of queue.poules || []) {
    if (p.poule_id) queueByPouleId[p.poule_id] = p
  }

  const poulesByClub = {}
  for (const t of allTeams) {
    if (!t.recent_poule_id) continue
    const qp = queueByPouleId[t.recent_poule_id]
    if (!qp) continue
    if (!poulesByClub[t.club_external_id]) poulesByClub[t.club_external_id] = { total: 0, captured: 0 }
    poulesByClub[t.club_external_id].total++
    if (qp.captured && !qp.stale) poulesByClub[t.club_external_id].captured++
  }

  const youthCount   = allTeams.filter(t => t.category_group_name === 'Junioren').length
  const veldCount    = allTeams.filter(t => resolveHockeyType(t) === 'VE').length
  const zaalCount    = allTeams.filter(t => resolveHockeyType(t) === 'ZA').length
  const detailLoaded = clubs.filter(c => c.detail_loaded).length
  const noDetail     = clubs.length - detailLoaded

  const sortedClubs = [...clubs].sort((a, b) => {
    const aLen = (teamsByClub[a.external_id] || []).length
    const bLen = (teamsByClub[b.external_id] || []).length
    if (aLen !== bLen) return bLen - aLen
    return (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name, 'nl')
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Stats — altijd zichtbaar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={statBox}><span style={statNum}>{clubs.length}</span><span style={statLbl}>clubs</span></div>
        <div style={statBox}><span style={statNum}>{detailLoaded}</span><span style={statLbl}>detail geladen</span></div>
        <div style={statBox}><span style={statNum}>{youthCount}</span><span style={statLbl}>jeugdteams</span></div>
        <div style={statBox}><span style={statNum}>{veldCount}</span><span style={statLbl}>🏑 veld</span></div>
        <div style={statBox}><span style={statNum}>{zaalCount}</span><span style={statLbl}>🏒 zaal</span></div>
        <div style={{ ...statBox, borderColor: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-border)' }}>
          <span style={{ ...statNum, color: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
            {queue.captured}/{queue.total}
          </span>
          <span style={statLbl}>poules {queue.target_season || '2026-2027'}</span>
        </div>
        {queue.stale > 0 && (
          <div style={statBox}>
            <span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.stale}</span>
            <span style={statLbl}>oud seizoen</span>
          </div>
        )}
        {queue.waiting > 0 && (
          <div style={statBox}>
            <span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.waiting}</span>
            <span style={statLbl}>⏳ wacht</span>
          </div>
        )}
        {pluginErrors.length > 0 && (
          <div style={{ ...statBox, borderColor: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => setErrOpen(true)}>
            <span style={{ ...statNum, color: 'var(--color-danger)' }}>{pluginErrors.length}</span>
            <span style={statLbl}>plugin fouten</span>
          </div>
        )}
        <button onClick={load} style={{ ...ghostBtn, alignSelf: 'center' }}>↻ Vernieuwen</button>
        <button onClick={() => setAutoRefresh(v => {
          const next = !v
          try { localStorage.setItem('disc_auto_refresh', next) } catch {}
          return next
        })} style={{
          ...ghostBtn, alignSelf: 'center',
          borderColor: autoRefresh ? 'var(--color-primary)' : 'var(--color-border)',
          color: autoRefresh ? 'var(--color-primary)' : 'var(--color-text-muted)',
          fontWeight: autoRefresh ? 700 : 400,
        }}>⟳ live{autoRefresh ? ' ✓' : ''}</button>
      </div>

      {error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      {/* ── RESULTATEN ── */}
      {view === 'resultaten' && (
        <>
          {/* Competities */}
          {competitions.length > 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div onClick={() => setCompOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{compOpen ? '▾' : '▸'}</span>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>🏆 Competities</span>
                <span style={pill('muted')}>{competitions.length} gevonden</span>
              </div>
              {compOpen && (
                <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {['VE', 'ZA', ''].map(ht => {
                    const group = competitions.filter(c => (ht === '' ? !c.hockey_type || (c.hockey_type !== 'VE' && c.hockey_type !== 'ZA') : c.hockey_type === ht))
                    if (!group.length) return null
                    const htLabel = ht === 'VE' ? '🏑 Veldhockey' : ht === 'ZA' ? '🏒 Zaalhockey' : '⚪ Onbekend type'
                    return (
                      <div key={ht || 'other'}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em', marginBottom: 4, marginTop: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 3 }}>
                          {htLabel}
                        </div>
                        {group.map(c => {
                          const cKey    = 'comp_' + c.id
                          const cOpen   = expanded.has(cKey)
                          const cPoules = capturedPoules
                            .filter(p => p.competition_id === c.id)
                            .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
                          return (
                            <div key={c.id}>
                              <div
                                onClick={() => cPoules.length > 0 && toggle(cKey)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12, cursor: cPoules.length > 0 ? 'pointer' : 'default', userSelect: 'none' }}>
                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
                                  {cPoules.length > 0 ? (cOpen ? '▾' : '▸') : ''}
                                </span>
                                <span style={{ flex: 1 }}>{c.name}</span>
                                {c.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.class_name}</span>}
                                {c.district   && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.district}</span>}
                                <span style={pill(cPoules.length > 0 ? 'partial' : 'muted')}>{cPoules.length}/{c.poule_count} poules</span>
                              </div>
                              {cOpen && (
                                <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
                                  {cPoules.map(p => {
                                    const pKey   = 'poule_' + p.poule_id
                                    const pOpen  = expanded.has(pKey)
                                    const pTeams = allTeams
                                      .filter(t => t.recent_poule_id === p.poule_id)
                                      .sort((a, b) => a.short_name.localeCompare(b.short_name, 'nl'))
                                    return (
                                      <div key={p.poule_id}>
                                        <div
                                          onClick={() => pTeams.length > 0 && toggle(pKey)}
                                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', fontSize: 11, cursor: pTeams.length > 0 ? 'pointer' : 'default', userSelect: 'none' }}>
                                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
                                            {pTeams.length > 0 ? (pOpen ? '▾' : '▸') : '·'}
                                          </span>
                                          <span style={{ flex: 1, color: 'var(--color-text)' }}>{p.name}</span>
                                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>#{p.poule_id}</span>
                                          {pTeams.length > 0 && <span style={pill('ok')}>{pTeams.length} teams</span>}
                                        </div>
                                        {pOpen && (
                                          <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
                                            {pTeams.map(t => (
                                              <div key={t.team_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 2px', fontSize: 11 }}>
                                                <span style={{ width: 80, flexShrink: 0, fontWeight: 500 }}>{t.short_name}</span>
                                                <span style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 10 }}>{clubMap[t.club_external_id] || t.club_external_id}</span>
                                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>#{t.team_id}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Clublijst */}
          {sortedClubs.map(c => {
            const teams   = teamsByClub[c.external_id] || []
            const pStats  = poulesByClub[c.external_id]
            const cap     = pStats ? pStats.captured : 0
            const tot     = pStats ? pStats.total    : 0
            const pVar    = tot === 0 ? 'muted' : cap === tot ? 'ok' : cap > 0 ? 'partial' : 'muted'
            const isOpen  = expanded.has(c.external_id)

            const byType = {}
            for (const t of teams) {
              const ht = resolveHockeyType(t)
              if (!byType[ht]) byType[ht] = {}
              if (!byType[ht][t.category_group_name]) byType[ht][t.category_group_name] = []
              byType[ht][t.category_group_name].push(t)
            }
            const types = HT_ORDER.filter(ht => byType[ht])
            const multiType = types.length > 1

            return (
              <div key={c.external_id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => toggle(c.external_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12, flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 80 }}>{c.friendly_name || c.name}</span>
                  {c.city && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.city}</span>}
                  <span style={pill(c.detail_loaded ? 'ok' : 'muted')}>{c.detail_loaded ? '✓ detail' : '– geen detail'}</span>
                  {teams.filter(t => resolveHockeyType(t) === 'VE').length > 0 && (
                    <span style={pill('muted')}>🏑 {teams.filter(t => resolveHockeyType(t) === 'VE').length}</span>
                  )}
                  {teams.filter(t => resolveHockeyType(t) === 'ZA').length > 0 && (
                    <span style={pill('muted')}>🏒 {teams.filter(t => resolveHockeyType(t) === 'ZA').length}</span>
                  )}
                  {pStats && <span style={pill(pVar)}>{cap}/{tot} poules</span>}
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(c.district || c.address || c.phone || c.email || c.website) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {c.district && <span>📍 {c.district}</span>}
                        {c.address  && <span>{c.address}{c.zipcode ? ', ' + c.zipcode : ''}</span>}
                        {c.phone    && <span>📞 {c.phone}</span>}
                        {c.email    && <span>✉ {c.email}</span>}
                        {c.website  && (
                          <a href={c.website} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--color-primary)', fontSize: 12 }}
                            onClick={e => e.stopPropagation()}>
                            🌐 {c.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    )}

                    {types.length > 0 ? types.map(ht => {
                      const catMap = byType[ht]
                      const cats = sortCats(Object.keys(catMap))
                      return (
                        <div key={ht}>
                          {multiType && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em', marginBottom: 6, borderBottom: '1px solid var(--color-border)', paddingBottom: 3 }}>
                              {HT_LABEL[ht]}
                            </div>
                          )}
                          {cats.map(cat => {
                            const catTeams = [...catMap[cat]].sort((a, b) => a.short_name.localeCompare(b.short_name, 'nl'))
                            return (
                              <div key={cat} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                  {cat} <span style={{ fontWeight: 400 }}>({catTeams.length})</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {catTeams.map(t => {
                                    const qp          = t.recent_poule_id ? (queueByPouleId[t.recent_poule_id] ?? null) : null
                                    const hasCaptured = qp && qp.captured && !qp.stale
                                    const isStale     = qp && qp.stale
                                    const hasPoule    = !!t.recent_poule_id
                                    const v           = hasCaptured ? 'ok' : isStale ? 'muted' : hasPoule ? 'partial' : 'muted'
                                    const titleSuffix = isStale ? ' · oud seizoen' : hasCaptured ? ' · gevangen' : hasPoule ? ' · wacht op scan' : ' · geen poule'
                                    return (
                                      <span key={t.team_id} style={{ ...pill(v), opacity: isStale ? 0.55 : 1 }}
                                        title={t.name + (t.recent_poule_id ? ' · poule ' + t.recent_poule_id : ' · geen poule') + titleSuffix}>
                                        {t.short_name}
                                        {isStale     && <span style={{ opacity: 0.65 }}>↩</span>}
                                        {hasCaptured && <span style={{ opacity: 0.65 }}>✓</span>}
                                        {!isStale && !hasCaptured && hasPoule && <span style={{ opacity: 0.65 }}>○</span>}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }) : (
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                        Geen teams geladen — scan deze club via de vanger
                      </p>
                    )}

                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.5 }}>{c.external_id}</div>
                  </div>
                )}
              </div>
            )
          })}

          {!loading && clubs.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Geen clubs — surf naar www.hockey.nl met de hockey-vanger actief
            </div>
          )}
        </>
      )}

      {/* ── VANGER MANAGER ── */}
      {view === 'vanger' && (
        <>
          {/* Vanger live status */}
          {vangerStatus && (() => {
            const seenAt = vangerStatus.last_seen ? new Date(vangerStatus.last_seen + 'Z') : null
            const ageSec = seenAt ? Math.round((Date.now() - seenAt.getTime()) / 1000) : null
            const online = ageSec !== null && ageSec < 60
            const running = vangerStatus.running && online
            const modeLabel = { poule_scan: '⚡ Poule scan', club_rescan: '🏢 Club-rescan', idle: '—' }
            return (
              <div style={{ background: 'var(--color-surface)', border: `1px solid ${running ? 'var(--color-success)' : online ? 'var(--color-border)' : 'var(--color-border)'}`, borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{running ? '🟢' : online ? '🟡' : '⚫'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {running ? (modeLabel[vangerStatus.mode] || vangerStatus.mode) : online ? 'Vanger online · inactief' : 'Vanger offline'}
                  </div>
                  {running && vangerStatus.task && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      → {vangerStatus.task}
                      {vangerStatus.done_count > 0 && <span style={{ marginLeft: 6 }}>({vangerStatus.done_count} gedaan)</span>}
                    </div>
                  )}
                </div>
                {seenAt && (
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {ageSec < 60 ? ageSec + 's geleden' : Math.round(ageSec / 60) + 'm geleden'}
                  </span>
                )}
              </div>
            )
          })()}

          {/* ── Cmd Queue ── */}
          {(() => {
            const counts     = cmdQueue?.counts || {}
            const recent     = cmdQueue?.recent || []
            const pending    = counts.pending    || 0
            const inProgress = counts.in_progress || 0
            const done       = counts.done        || 0
            const failed     = counts.failed      || 0
            const skipped    = counts.skipped     || 0
            const hasAny     = pending + inProgress + done + failed + skipped > 0
            const total      = pending + inProgress + done + failed + skipped
            const finished   = done + failed + skipped
            const progress   = total > 0 ? Math.round((finished / total) * 100) : 0
            const isRunning  = inProgress > 0 || pending > 0
            const STATUS_COLOR = { pending: 'var(--color-text-muted)', in_progress: 'var(--color-warning)', done: 'var(--color-success)', failed: 'var(--color-danger)', skipped: 'var(--color-text-muted)' }
            const STATUS_ICON  = { pending: '⏳', in_progress: '🔄', done: '✓', failed: '✗', skipped: '⏭' }

            return (
              <div style={{ background: 'var(--color-surface)', border: `1px solid ${failed > 0 && !isRunning ? 'var(--color-danger)' : isRunning ? 'var(--color-warning)' : done > 0 ? 'var(--color-success)' : 'var(--color-border)'}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* Header */}
                <div onClick={() => setCmdOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{cmdOpen ? '▾' : '▸'}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>⚡ Cmd queue</span>
                  {inProgress > 0 && <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 700 }}>● {inProgress} bezig</span>}
                  {pending > 0    && <span style={pill('partial')}>{pending} wacht</span>}
                  {done > 0       && <span style={pill('ok')}>✓ {done}</span>}
                  {failed > 0     && <span style={{ ...pill('muted'), color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>✗ {failed}</span>}
                  {skipped > 0    && <span style={pill('muted')}>⏭ {skipped}</span>}
                </div>

                {/* Progress bar */}
                {isRunning && total > 1 && (
                  <div style={{ height: 2, background: 'var(--color-border)' }}>
                    <div style={{ height: '100%', width: progress + '%', background: 'var(--color-warning)', transition: 'width 0.5s ease' }} />
                  </div>
                )}

                {cmdOpen && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Actieknoppen */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => fillCmdQueue('poules')} disabled={!!cmdFilling}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', opacity: cmdFilling === 'poules' ? 0.6 : 1 }}>
                        {cmdFilling === 'poules' ? '…' : '+ Poules vullen'}
                      </button>
                      <button onClick={() => fillCmdQueue('clubs')} disabled={!!cmdFilling}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', opacity: cmdFilling === 'clubs' ? 0.6 : 1 }}>
                        {cmdFilling === 'clubs' ? '…' : '+ Clubs vullen'}
                      </button>
                      {failed > 0 && (
                        <button onClick={retryAllFailed}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-warning)', background: 'none', color: 'var(--color-warning)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          ↺ Retry alle ({failed})
                        </button>
                      )}
                      {(pending + inProgress) > 0 && (
                        <button onClick={clearCmdQueue}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-danger)', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          🗑 Pending leeg
                        </button>
                      )}
                      {(done + skipped) > 0 && !(pending + inProgress) && (
                        <button onClick={clearDoneCmds}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          🗑 Done wissen
                        </button>
                      )}
                    </div>

                    {/* Voortgang samenvatting */}
                    {isRunning && total > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 8px', background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)' }}>
                        🔄 {finished}/{total} klaar ({progress}%) — {pending} in wacht{inProgress > 0 ? `, ${inProgress} bezig` : ''}
                      </div>
                    )}

                    {/* Cmd lijst */}
                    {recent.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {recent.slice(0, 25).map(c => {
                          const p      = c.params || {}
                          const label  = p.label || p.external_id || '–'
                          const subId  = c.cmd_type === 'get_poule' ? p.poule_id : p.external_id
                          const badge  = TYPE_BADGE[c.cmd_type]
                          const summ   = c.result_summary
                          const concl  = summ ? makeCmdConclusion(c, summ) : null
                          const durStr = summ?.duration_ms != null ? fmtDuration(summ.duration_ms) : null
                          const szStr  = summ?.raw_bytes ? fmtBytes(summ.raw_bytes) : null
                          const color  = STATUS_COLOR[c.status] || 'var(--color-text-muted)'
                          const icon   = STATUS_ICON[c.status]  || '?'
                          const fin    = c.finished_at
                            ? new Date(c.finished_at + 'Z').toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : null

                          return (
                            <div key={c.id} style={{ padding: '5px 2px', borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                              {/* Hoofdregel */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                <span style={{ color, fontWeight: 700, fontSize: 12, flexShrink: 0, width: 14 }}>{icon}</span>
                                {badge && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: badge.bg, color: badge.color, flexShrink: 0, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                                    {badge.label}
                                  </span>
                                )}
                                <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                  {label}
                                  {subId && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> · #{subId}</span>}
                                </span>
                                {durStr && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{durStr}</span>}
                                {fin    && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fin}</span>}
                                {c.status === 'failed' && (
                                  <button onClick={() => retryCmdQueue(c.id)}
                                    style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0 }}>↺</button>
                                )}
                              </div>

                              {/* Conclusie / fout */}
                              {(concl || c.error) && (
                                <div style={{ marginLeft: 19, marginTop: 2, fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: c.error ? 'var(--color-danger)' : 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.error || concl}
                                  </span>
                                  {szStr && <span style={{ color: 'var(--color-text-muted)', opacity: 0.6, flexShrink: 0 }}>{szStr}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!hasAny && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Queue leeg — vul met poules of clubs, of voeg individuele items toe via de queues hieronder
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {noDetail > 0 && !loading && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 8, border: '1px dashed var(--color-border)' }}>
              ⚠️ {noDetail} clubs zonder detail — scan via de vanger op www.hockey.nl
            </div>
          )}

          {/* Queue filter — altijd tonen zodat je kunt terugschakelen ook als queue leeg is */}
          {(
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎛 Queue filter</div>

              {/* Niveau */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Niveau</span>
                {['Junioren', 'Senioren'].map(cat => {
                  const on = qFilter.categories.includes(cat)
                  return (
                    <button key={cat} onClick={() => toggleNiveau(cat)} style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: on ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: on ? '#fff' : 'var(--color-text)', fontWeight: on ? 600 : 400,
                    }}>{cat}</button>
                  )
                })}
              </div>

              {/* Geslacht */}
              {(() => {
                const hasJun = qFilter.categories.includes('Junioren')
                const hasSen = qFilter.categories.includes('Senioren')
                const options = [
                  ...(hasJun ? ['Jongens', 'Meisjes'] : []),
                  ...(hasSen ? ['Heren', 'Dames'] : []),
                ]
                if (!options.length) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Geslacht</span>
                    {options.map(g => {
                      const on = qFilter.genders.includes(g)
                      return (
                        <button key={g} onClick={() => toggleGender(g)} style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          background: on ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: on ? '#fff' : 'var(--color-text)', fontWeight: on ? 600 : 400,
                        }}>{g}</button>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Hockey type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Type</span>
                {['VE', 'ZA'].map(ht => {
                  const on = qFilter.hockey_types.includes(ht)
                  return (
                    <button key={ht} onClick={() => toggleHt(ht)} style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: on ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: on ? '#fff' : 'var(--color-text)', fontWeight: on ? 600 : 400,
                    }}>{HT_LABEL[ht] || ht}</button>
                  )
                })}
              </div>

              {/* Leeftijdsgroep — alleen bij Junioren */}
              {qFilter.categories.includes('Junioren') && (() => {
                const AGE_RE_G = /[JMjm][OZoz](\d+)-/
                const ageOfG = sn => { const m = AGE_RE_G.exec(sn || ''); return m ? 'O' + m[1] : null }
                const availAges = [...new Set(
                  (queue.poules || []).filter(p => p.has_poule !== false).map(p => ageOfG(p.short_name)).filter(Boolean)
                )].sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)))
                if (!availAges.length) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Leeftijd</span>
                    {availAges.map(ag => {
                      const on = qFilter.age_groups.includes(ag)
                      return (
                        <button key={ag} onClick={() => toggleAge(ag)} style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          background: on ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: on ? '#fff' : 'var(--color-text)', fontWeight: on ? 600 : 400,
                        }}>{ag}</button>
                      )
                    })}
                    {qFilter.age_groups.length > 0 && (
                      <button onClick={() => saveFilter({ ...qFilter, age_groups: [] })}
                        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                          border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)' }}>
                        × alles
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* Club */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Club</span>
                <select
                  value={qFilter.club_external_id || ''}
                  onChange={e => saveFilter({ ...qFilter, club_external_id: e.target.value || null })}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit',
                    borderColor: qFilter.club_external_id ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <option value="">— alle clubs —</option>
                  {(() => {
                    const idsInQueue = new Set()
                    for (const p of (queue.poules || [])) {
                      idsInQueue.add(p.club_external_id)
                      for (const id of (p.clubs_in_poule || [])) idsInQueue.add(id)
                    }
                    return clubs
                      .filter(c => idsInQueue.has(c.external_id))
                      .sort((a, b) => (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name, 'nl'))
                      .map(c => (
                        <option key={c.external_id} value={c.external_id}>{c.friendly_name || c.name}</option>
                      ))
                  })()}
                </select>
                {qFilter.club_external_id && (
                  <button onClick={() => saveFilter({ ...qFilter, club_external_id: null })}
                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)' }}>
                    × wissen
                  </button>
                )}
              </div>

              {/* Wacht op indeling toggle */}
              {queue.waiting > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>Toon</span>
                  <button onClick={() => {
                    const next = !showWaiting
                    setShowWaiting(next)
                    try { localStorage.setItem('disc_show_waiting', String(next)) } catch {}
                  }} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${showWaiting ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: showWaiting ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: showWaiting ? '#fff' : 'var(--color-text)', fontWeight: showWaiting ? 600 : 400,
                  }}>⏳ wacht op indeling ({queue.waiting})</button>
                </div>
              )}

              {(qFilter.age_groups.length > 0 || qFilter.club_external_id || qFilter.genders?.length > 0) && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Filter actief — de vanger pakt alleen deze teams op
                </div>
              )}
            </div>
          )}

          {/* Plugin fouten */}
          {pluginErrors.length > 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-danger)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', userSelect: 'none' }}>
                <span onClick={() => setErrOpen(o => !o)} style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12, cursor: 'pointer' }}>{errOpen ? '▾' : '▸'}</span>
                <span onClick={() => setErrOpen(o => !o)} style={{ fontWeight: 600, fontSize: 13, flex: 1, color: 'var(--color-danger)', cursor: 'pointer' }}>⚠️ Plugin fouten</span>
                <span style={pill('muted')}>{pluginErrors.length} recent</span>
                <button
                  onClick={() => { if (window.confirm('Alle plugin fouten wissen?')) api.delete('/api/tournix/discovery/plugin-errors').then(() => setPluginErrors([])) }}
                  style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 4, cursor: 'pointer' }}
                >legen</button>
              </div>
              {errOpen && (
                <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pluginErrors.map(e => (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(e.captured_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ color: 'var(--color-danger)' }}>
                        {e.message}
                        {e.meta?.context && <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>({e.meta.context})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Club-scan queue */}
          {clubScanQueue.total > 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div onClick={() => toggle('club_scan_q')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{expanded.has('club_scan_q') ? '▾' : '▸'}</span>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>🏢 Club-scan queue</span>
                <span style={{ ...pill('partial'), color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}>{clubScanQueue.total} clubs</span>
              </div>
              {expanded.has('club_scan_q') && (
                <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 2px 8px', fontStyle: 'italic' }}>
                    Poule gescand maar bond heeft nog geen nieuw seizoen — club opnieuw scannen om nieuwe poule-ID op te halen
                  </div>
                  {clubScanQueue.clubs.map(c => {
                    const addKey = 'scan_club_' + c.club_external_id
                    const addState = cmdAdding[addKey]
                    return (
                      <div key={c.club_external_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', fontSize: 11, borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                        <span style={{ flex: 1 }}>{c.friendly_name || c.name}</span>
                        {c.city && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.city}</span>}
                        <span style={{ ...pill('partial'), fontSize: 10 }}>{c.pending_teams} teams</span>
                        <button
                          disabled={!!addState}
                          onClick={() => addSingleCmd('scan_club', { external_id: c.club_external_id, label: c.friendly_name || c.name })}
                          style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, cursor: addState ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                            border: `1px solid ${addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                            background: 'none',
                            color: addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                          }}>
                          {addState === 'adding' ? '…' : addState === 'added' ? '✓ toegevoegd' : addState === 'exists' ? '⚠ al in queue' : '+ cmd'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Poule queue */}
          {queue.total > 0 && (() => {
            const AGE_RE = /[JMjm][OZoz](\d+)-/
            const ageOf  = sn => { const m = AGE_RE.exec(sn || ''); return m ? 'O' + m[1] : '?' }
            const allAgesInQueue = [...new Set(
              (queue.poules || []).filter(p => p.has_poule !== false).map(p => ageOf(p.short_name)).filter(a => a !== '?')
            )].sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)))
            const ages = allAgesInQueue
            const byAge  = {}
            for (const p of queue.poules || []) {
              const ag = ageOf(p.short_name)
              if (!byAge[ag]) byAge[ag] = { missing: 0, stale: 0, captured: 0, waiting: 0, items: [], waitingItems: [] }
              if (p.has_poule === false) {
                if (showWaiting) {
                  byAge[ag].waiting++
                  byAge[ag].waitingItems.push(p)
                }
              } else {
                byAge[ag].items.push(p)
                if (p.stale)         byAge[ag].stale++
                else if (p.captured) byAge[ag].captured++
                else                 byAge[ag].missing++
              }
            }
            const knownAges = ages.filter(a => byAge[a])
            const otherAges = Object.keys(byAge).filter(a => !ages.includes(a)).sort()
            const allAgesRaw = [...knownAges, ...otherAges]
            const allAges = qFilter.age_groups.length > 0
              ? allAgesRaw.filter(a => qFilter.age_groups.includes(a))
              : allAgesRaw

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

            return (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setQueueOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{queueOpen ? '▾' : '▸'}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>📋 Poule queue</span>
                  <span style={pill(queue.captured === queue.total ? 'ok' : queue.captured > 0 ? 'partial' : 'muted')}>{queue.captured}/{queue.total} teams</span>
                  {queue.missing > 0 && <span style={pill('muted')}>{queue.missing} open</span>}
                  {queue.stale   > 0 && <span style={{ ...pill('muted'), color: 'var(--color-warning)' }}>{queue.stale} oud</span>}
                </div>
                {queueOpen && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {allAges.map(ag => {
                      const g = byAge[ag]
                      const agOpen = expanded.has('q_' + ag)
                      const allCap = g.missing === 0 && g.stale === 0
                      return (
                        <div key={ag}>
                          <div onClick={() => toggle('q_' + ag)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 2px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10 }}>{agOpen ? '▾' : '▸'}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, width: 32, color: allCap ? 'var(--color-success)' : 'var(--color-text)' }}>{ag}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>{g.items.length} teams</span>
                            {g.missing   > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{g.missing} open</span>}
                            {g.stale     > 0 && <span style={{ fontSize: 10, color: 'var(--color-warning)', marginLeft: 4 }}>{g.stale} oud</span>}
                            {g.captured  > 0 && <span style={{ fontSize: 10, color: 'var(--color-success)', marginLeft: 4 }}>✓ {g.captured}</span>}
                            {g.waiting   > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4, opacity: 0.6 }}>⏳ {g.waiting}</span>}
                          </div>
                          {agOpen && g.items.filter(p =>
                            !qFilter.club_external_id ||
                            p.club_external_id === qFilter.club_external_id ||
                            (p.clubs_in_poule || []).includes(qFilter.club_external_id)
                          ).map(p => {
                            const filterTeam = qFilter.club_external_id && p.club_external_id !== qFilter.club_external_id
                              ? allTeams.find(t => t.club_external_id === qFilter.club_external_id && t.recent_poule_id === p.poule_id)
                              : null
                            const addKey   = 'get_poule_' + p.poule_id
                            const addState = cmdAdding[addKey]
                            return (
                              <div key={p.poule_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px 3px 18px', fontSize: 11, borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                                <span style={{ flex: 1, color: p.stale ? 'var(--color-text-muted)' : 'var(--color-text)', opacity: p.stale ? 0.6 : 1 }}>
                                  {filterTeam ? filterTeam.name : p.team_name}
                                  {filterTeam && <span style={{ color: 'var(--color-text-muted)', fontSize: 9, marginLeft: 5, fontStyle: 'italic' }}>via {p.team_name}</span>}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>#{p.poule_id}</span>
                                {p.captured && !p.stale && <span style={{ color: 'var(--color-success)', fontSize: 10 }}>✓</span>}
                                {p.stale                && <span style={{ color: 'var(--color-warning)',  fontSize: 10 }}>↩</span>}
                                {(p.captured || p.stale) && (
                                  <button onClick={() => resetPoule(p.poule_id)}
                                    style={{ fontSize: 10, padding: '1px 5px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 3, cursor: 'pointer' }}>reset</button>
                                )}
                                {!p.captured && p.poule_id && (
                                  <button
                                    disabled={!!addState}
                                    onClick={() => addSingleCmd('get_poule', { poule_id: p.poule_id, team_id: p.team_id, label: p.short_name || p.team_name })}
                                    style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, cursor: addState ? 'default' : 'pointer', fontFamily: 'inherit',
                                      border: `1px solid ${addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                      background: 'none',
                                      color: addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                    }}>
                                    {addState === 'adding' ? '…' : addState === 'added' ? '✓' : addState === 'exists' ? '⚠' : '+ cmd'}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          {agOpen && g.waitingItems.filter(p => !qFilter.club_external_id || p.club_external_id === qFilter.club_external_id).map(p => (
                            <div key={p.team_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px 3px 18px', fontSize: 11, borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)', opacity: 0.5 }}>
                              <span style={{ flex: 1, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{p.team_name}</span>
                              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>⏳ geen poule</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ID-reeks per seizoen */}
          {rangeData && rangeData.seasons.length > 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>📊 Poule ID-reeks</span>
                <button onClick={runInfer} disabled={isInferring} style={{ ...ghostBtn, alignSelf: 'center' }}>
                  {isInferring ? '⏳ bezig…' : '⚡ Infereer seizoen'}
                </button>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rangeData.seasons.map(s => (
                  <div key={s.season} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '2px 0' }}>
                    <span style={{ fontWeight: 600, minWidth: 72 }}>{s.season}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {s.min_id} – {s.max_id}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>({s.count} poules, span {s.span})</span>
                    {s.gap_before > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        gap: {s.gap_before}
                      </span>
                    )}
                  </div>
                ))}
                {inferResult && (
                  <div style={{ marginTop: 6, fontSize: 11, padding: '5px 8px', borderRadius: 6,
                    background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))',
                    color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                    ⚡ {inferResult.marked_pending} teams → season_pending
                    {inferResult.cleared_pending > 0 && `, ${inferResult.cleared_pending} gecleard`}
                    {inferResult.marked_pending === 0 && inferResult.cleared_pending === 0 && ' — alles al correct'}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && queue.total === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Geen poule queue — teams worden geladen zodra de vanger clubs heeft gescand
            </div>
          )}
        </>
      )}

    </div>
  )
}
