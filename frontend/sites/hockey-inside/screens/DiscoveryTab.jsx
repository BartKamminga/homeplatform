import { useState, useEffect, useRef } from 'react'
import { api } from '@core/api.js'
import DiscoveryCompetities from './DiscoveryCompetities.jsx'
import DiscoveryClubs from './DiscoveryClubs.jsx'

const HOCKEY_TYPES = ['VE', 'ZA', '']
const AGE_GROUPS   = ['Senioren', 'Jeugd']

function districtKeys(dist) {
  const keys = new Set()
  for (const ht of HOCKEY_TYPES)
    for (const ag of AGE_GROUPS)
      keys.add(`dist_${ht}_${ag}_${dist}`)
  return keys
}

function tabStyle(active) {
  return {
    fontSize: 12, padding: '5px 14px', borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text)',
    fontWeight: active ? 600 : 400,
  }
}

export default function DiscoveryTab({ initialDistrict }) {
  const [clubs,          setClubs]          = useState([])
  const [competitions,   setCompetitions]   = useState([])
  const [allTeams,       setAllTeams]       = useState([])
  const [queue,          setQueue]          = useState({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
  const [capturedPoules, setCapturedPoules] = useState([])

  const [season,       setSeason]       = useState('2026-2027')
  const [loading,      setLoading]      = useState(true)
  const [detailLoaded, setDetailLoaded] = useState(false)
  const [error,        setError]        = useState('')
  const [discTab,      setDiscTab]      = useState('competities')

  // Districts open: vul vanuit initialDistrict zodat kaart-navigatie direct het juiste district opent
  const [expanded, setExpanded] = useState(() => initialDistrict ? districtKeys(initialDistrict) : new Set())

  const detailRequestedRef = useRef(false)

  function loadDetail(currentSeason) {
    if (detailRequestedRef.current) return
    detailRequestedRef.current = true
    Promise.all([
      api.get('/api/hockey/teams'),
      api.get('/api/hockey/poule-queue'),
      api.get(`/api/hockey/poules?season=${currentSeason}`),
    ]).then(([teamsRes, queueRes, poulesRes]) => {
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setCapturedPoules(poulesRes.poules || [])
      setDetailLoaded(true)
    }).catch(e => setError(e.message))
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    detailRequestedRef.current = false
    setDetailLoaded(false)
    setAllTeams([])
    setQueue({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
    setCapturedPoules([])

    Promise.all([
      api.get('/api/hockey/clubs?slim=true'),
      api.get(`/api/hockey/competitions?season=${season}`),
    ]).then(([clubsRes, compsRes]) => {
      setClubs(clubsRes.clubs || [])
      setCompetitions(compsRes.competitions || [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [season])

  function toggle(key) {
    loadDetail(season)
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleDiscTab(t) {
    if (t === 'clubs') loadDetail(season)
    setDiscTab(t)
  }

  // Pre-computed lookups (gedeeld tussen sub-views)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Seizoen selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Seizoen:</span>
        {['2024-2025', '2025-2026', '2026-2027'].map(s => (
          <button key={s} onClick={() => setSeason(s)} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 99, fontFamily: 'inherit', cursor: 'pointer',
            border: `1px solid ${season === s ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: season === s ? 'var(--color-primary)' : 'var(--color-surface)',
            color: season === s ? '#fff' : 'var(--color-text)',
          }}>{s}</button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => handleDiscTab('competities')} style={tabStyle(discTab === 'competities')}>
          🏆 Competities{competitions.length > 0 ? ` (${competitions.length})` : ''}
        </button>
        <button onClick={() => handleDiscTab('clubs')} style={tabStyle(discTab === 'clubs')}>
          🏑 Clubs{clubs.length > 0 ? ` (${clubs.length})` : ''}
        </button>
      </div>

      {error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      {discTab === 'competities' && (
        <DiscoveryCompetities
          competitions={competitions}
          capturedPoules={capturedPoules}
          allTeams={allTeams}
          clubMap={clubMap}
          expanded={expanded}
          toggle={toggle}
          loading={loading}
          detailLoaded={detailLoaded}
          season={season}
          onReload={() => {
            detailRequestedRef.current = false
            setDetailLoaded(false)
            loadDetail(season)
          }}
        />
      )}

      {discTab === 'clubs' && (
        <DiscoveryClubs
          clubs={clubs}
          teamsByClub={teamsByClub}
          poulesByClub={poulesByClub}
          queueByPouleId={queueByPouleId}
          expanded={expanded}
          toggle={toggle}
          loading={loading}
        />
      )}

    </div>
  )
}
