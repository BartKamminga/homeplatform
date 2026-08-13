import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import DiscoveryCompetities from './DiscoveryCompetities.jsx'
import DiscoveryClubs from './DiscoveryClubs.jsx'

function tabStyle(active) {
  return {
    fontSize: 12, padding: '5px 14px', borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text)',
    fontWeight: active ? 600 : 400,
  }
}

export default function DiscoveryTab() {
  const [clubs,          setClubs]          = useState([])
  const [allTeams,       setAllTeams]       = useState([])
  const [queue,          setQueue]          = useState({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
  const [capturedPoules, setCapturedPoules] = useState([])
  const [competitions,   setCompetitions]   = useState([])
  const [season,         setSeason]         = useState('2026-2027')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [expanded,       setExpanded]       = useState(new Set())
  const [discTab,        setDiscTab]        = useState('competities')

  function load() {
    setLoading(true); setError('')
    Promise.all([
      api.get('/api/hockey/clubs'),
      api.get('/api/hockey/teams'),
      api.get('/api/hockey/poule-queue'),
      api.get(`/api/hockey/competitions?season=${season}`),
      api.get(`/api/hockey/poules?season=${season}`),
    ]).then(([clubsRes, teamsRes, queueRes, compsRes, poulesRes]) => {
      setClubs(clubsRes.clubs || [])
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setCompetitions(compsRes.competitions || [])
      setCapturedPoules(poulesRes.poules || [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [season])

  function toggle(key) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Pre-computed lookups (shared between sub-views)
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
        <button onClick={() => setDiscTab('competities')} style={tabStyle(discTab === 'competities')}>
          🏆 Competities{competitions.length > 0 ? ` (${competitions.length})` : ''}
        </button>
        <button onClick={() => setDiscTab('clubs')} style={tabStyle(discTab === 'clubs')}>
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
          season={season}
          onReload={load}
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
