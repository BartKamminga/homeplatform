import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { deleteEmptyCompetitions } from '../api.js'

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

function isJeugd(comp) {
  return /O\d+/i.test(comp.name)
}

const AGE_GROUP_ORDER = ['Senioren', 'Jeugd']

function resolveHockeyType(t) {
  if (t.hockey_type === 'VE' || t.hockey_type === 'ZA') return t.hockey_type
  if (t.short_name && t.short_name[0] === 'z') return 'ZA'
  return 'VE'
}

// ghostBtn-stijl lokaal voor de cleanup-knop
const _ghostBtn = { fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }

export default function DiscoveryTab({ view = 'resultaten' }) {
  const [clubs,          setClubs]          = useState([])
  const [allTeams,       setAllTeams]       = useState([])
  const [queue,          setQueue]          = useState({ total: 0, captured: 0, missing: 0, stale: 0, waiting: 0, poules: [] })
  const [capturedPoules, setCapturedPoules] = useState([])
  const [competitions,   setCompetitions]   = useState([])
  const [pluginErrors,   setPluginErrors]   = useState([])
  const [season,         setSeason]         = useState('2026-2027')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [expanded,       setExpanded]       = useState(new Set())
  const [compOpen,       setCompOpen]       = useState(false)
  const [cleanupMsg,     setCleanupMsg]     = useState('')
  const [clubSearch,     setClubSearch]     = useState('')
  const [cmdAdding,      setCmdAdding]      = useState({})

  async function handleCleanupEmpty() {
    try {
      const r = await deleteEmptyCompetitions(season)
      setCleanupMsg(`${r.deleted} lege competities verwijderd`)
      setTimeout(() => setCleanupMsg(''), 4000)
      load()
    } catch (e) { setCleanupMsg('Fout: ' + e.message) }
  }

  function addSingleCmd(type, params) {
    const key = type + '_' + (params.poule_id || params.external_id || params.comp_id || 'global')
    setCmdAdding(prev => ({ ...prev, [key]: 'adding' }))
    api.post('/api/tournix/discovery/vanger/cmd-queue/add', { cmd_type: type, params })
      .then(r => {
        setCmdAdding(prev => ({ ...prev, [key]: r.added ? 'added' : 'exists' }))
        setTimeout(() => setCmdAdding(prev => { const n = { ...prev }; delete n[key]; return n }), 2000)
      })
      .catch(() => setCmdAdding(prev => { const n = { ...prev }; delete n[key]; return n }))
  }

  function cmdBtn(type, params, label, color, sz = 'sm') {
    const key = type + '_' + (params.poule_id || params.external_id || params.comp_id || 'global')
    const s   = cmdAdding[key]
    const base = sz === 'md'
      ? { fontSize: 11, padding: '4px 10px', borderRadius: 6 }
      : { fontSize: 10, padding: '1px 7px', borderRadius: 4 }
    return (
      <button
        disabled={!!s}
        onClick={e => { e.stopPropagation(); addSingleCmd(type, params) }}
        style={{ ...base, border: `1px solid ${s === 'added' ? 'var(--color-success)' : s === 'exists' ? 'var(--color-warning)' : color}`,
          color: s === 'added' ? 'var(--color-success)' : s === 'exists' ? 'var(--color-warning)' : color,
          background: 'none', cursor: s ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
          transition: 'color .2s, border-color .2s' }}>
        {s === 'adding' ? '…' : s === 'added' ? '✓' : s === 'exists' ? '⚠' : label}
      </button>
    )
  }

  function load() {
    setLoading(true); setError('')
    Promise.all([
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/poule-queue'),
      api.get(`/api/tournix/discovery/competitions?season=${season}`),
      api.get('/api/tournix/discovery/plugin-errors?limit=30'),
      api.get(`/api/tournix/discovery/poules?season=${season}`),
    ]).then(([clubsRes, teamsRes, queueRes, compsRes, errRes, poulesRes]) => {
      setClubs(clubsRes.clubs || [])
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setCompetitions(compsRes.competitions || [])
      setPluginErrors(errRes.errors || [])
      setCapturedPoules(poulesRes.poules || [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [season])

  function toggle(extId) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(extId) ? next.delete(extId) : next.add(extId)
      return next
    })
  }

  const clubMap = {}
  const clubLogoMap = {}
  for (const c of clubs) {
    clubMap[c.external_id] = c.friendly_name || c.name
    if (c.logo_url) clubLogoMap[c.external_id] = c.logo_url
  }

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

  const sortedClubs = [...clubs].sort((a, b) => {
    const aLen = (teamsByClub[a.external_id] || []).length
    const bLen = (teamsByClub[b.external_id] || []).length
    if (aLen !== bLen) return bLen - aLen
    return (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name, 'nl')
  })

  const clubSearchLower = clubSearch.trim().toLowerCase()
  const visibleClubs = clubSearchLower
    ? sortedClubs.filter(c =>
        (c.friendly_name || c.name).toLowerCase().includes(clubSearchLower) ||
        (c.city || '').toLowerCase().includes(clubSearchLower) ||
        (c.district || '').toLowerCase().includes(clubSearchLower)
      )
    : sortedClubs

  const clubRenderItems = (() => {
    if (clubSearchLower) return visibleClubs.map(c => ({ type: 'club', club: c }))
    const byDist = {}
    for (const c of sortedClubs) {
      const d = c.district || 'Onbekend'
      if (!byDist[d]) byDist[d] = []
      byDist[d].push(c)
    }
    const items = []
    Object.keys(byDist)
      .sort((a, b) => a === 'Onbekend' ? 1 : b === 'Onbekend' ? -1 : a.localeCompare(b, 'nl'))
      .forEach(d => {
        items.push({ type: 'header', district: d, count: byDist[d].length })
        byDist[d].forEach(c => items.push({ type: 'club', club: c }))
      })
    return items
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Seizoen selector — altijd zichtbaar */}
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

      {/* Stats */}
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
          <div style={{ ...statBox, borderColor: 'var(--color-danger)' }}>
            <span style={{ ...statNum, color: 'var(--color-danger)' }}>{pluginErrors.length}</span>
            <span style={statLbl}>plugin fouten</span>
          </div>
        )}
      </div>

      {error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      {cleanupMsg && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{cleanupMsg}</p>}

      {/* Competities */}
      {competitions.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div onClick={() => setCompOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{compOpen ? '▾' : '▸'}</span>
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>🏆 Competities</span>
            <span style={pill('muted')}>{competitions.length} gevonden</span>
            <button
              onClick={e => { e.stopPropagation(); handleCleanupEmpty() }}
              style={{ ..._ghostBtn, fontSize: 11, padding: '2px 8px' }}
              title="Verwijder competities zonder poules"
            >🗑 Lege opruimen</button>
          </div>
          {compOpen && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['VE', 'ZA', ''].map(ht => {
                const group = competitions.filter(c => (ht === '' ? !c.hockey_type || (c.hockey_type !== 'VE' && c.hockey_type !== 'ZA') : c.hockey_type === ht))
                if (!group.length) return null
                const htLabel = ht === 'VE' ? '🏑 Veldhockey' : ht === 'ZA' ? '🏒 Zaalhockey' : '⚪ Onbekend type'

                const byAge = {
                  Senioren: group.filter(c => !isJeugd(c)),
                  Jeugd:    group.filter(c =>  isJeugd(c)),
                }

                return (
                  <div key={ht || 'other'}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em', marginBottom: 4, marginTop: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 3 }}>
                      {htLabel}
                    </div>
                    {AGE_GROUP_ORDER.map(ag => {
                      const ageGroup = byAge[ag]
                      if (!ageGroup.length) return null
                      return (
                        <div key={ag}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 2px 2px', opacity: 0.7 }}>
                            {ag} ({ageGroup.length})
                          </div>
                          {ageGroup.map(c => {
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
                                  {c.hl_comp_id && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>#{c.hl_comp_id}</span>}
                                  <span style={pill(cPoules.length > 0 ? 'partial' : 'muted')}>{cPoules.length}/{c.poule_count} poules</span>
                                  {c.hl_comp_id && cmdBtn('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name }, '⟳ comp', '#b45309')}
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
                                            {pTeams[0]?.team_id && cmdBtn('get_poule', { poule_id: p.poule_id, team_id: pTeams[0].team_id, label: p.name }, '+ cmd', 'var(--color-border)')}
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
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Clubs zoekfilter */}
      <input
        type="search"
        value={clubSearch}
        onChange={e => setClubSearch(e.target.value)}
        placeholder={`Zoek in ${clubs.length} clubs…`}
        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
      />

      {/* Clublijst */}
      {clubRenderItems.map(item => {
        if (item.type === 'header') {
          return (
            <div key={'h-' + item.district} style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '6px 2px 2px', marginTop: 2 }}>
              {item.district} <span style={{ fontWeight: 400 }}>({item.count})</span>
            </div>
          )
        }
        const c = item.club
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
              {c.logo_url && (
                <img src={c.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0, borderRadius: 3 }} />
              )}
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

    </div>
  )
}
