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
  const [clubs,        setClubs]        = useState([])
  const [allTeams,     setAllTeams]     = useState([])
  const [queue,        setQueue]        = useState({ total: 0, captured: 0, missing: 0, stale: 0, poules: [] })
  const [competitions, setCompetitions] = useState([])
  const [pluginErrors, setPluginErrors] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [expanded,     setExpanded]     = useState(new Set())
  const [compOpen,     setCompOpen]     = useState(false)
  const [errOpen,      setErrOpen]      = useState(false)
  const [queueOpen,    setQueueOpen]    = useState(false)

  function load() {
    setLoading(true); setError('')
    Promise.all([
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/youth-queue'),
      api.get('/api/tournix/discovery/competitions?season=2026-2027'),
      api.get('/api/tournix/discovery/plugin-errors?limit=30'),
    ]).then(([clubsRes, teamsRes, queueRes, compsRes, errRes]) => {
      setClubs(clubsRes.clubs || [])
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setCompetitions(compsRes.competitions || [])
      setPluginErrors(errRes.errors || [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function toggle(extId) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(extId) ? next.delete(extId) : next.add(extId)
      return next
    })
  }

  const teamsByClub = {}
  for (const t of allTeams) {
    if (!teamsByClub[t.club_external_id]) teamsByClub[t.club_external_id] = []
    teamsByClub[t.club_external_id].push(t)
  }

  const poulesByClub = {}
  const queueByTeamId = {}
  for (const p of queue.poules || []) {
    queueByTeamId[p.team_id] = p
    if (!poulesByClub[p.club_external_id]) poulesByClub[p.club_external_id] = { total: 0, captured: 0 }
    poulesByClub[p.club_external_id].total++
    if (p.captured) poulesByClub[p.club_external_id].captured++
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
          <span style={statLbl}>poules 2026-2027</span>
        </div>
        {queue.stale > 0 && (
          <div style={statBox}>
            <span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.stale}</span>
            <span style={statLbl}>oud seizoen</span>
          </div>
        )}
        {pluginErrors.length > 0 && (
          <div style={{ ...statBox, borderColor: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => setErrOpen(true)}>
            <span style={{ ...statNum, color: 'var(--color-danger)' }}>{pluginErrors.length}</span>
            <span style={statLbl}>plugin fouten</span>
          </div>
        )}
        <button onClick={load} style={{ ...ghostBtn, alignSelf: 'center' }}>↻ Vernieuwen</button>
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
                        {group.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12 }}>
                            <span style={{ flex: 1 }}>{c.name}</span>
                            {c.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.class_name}</span>}
                            {c.district   && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.district}</span>}
                            <span style={pill('muted')}>{c.poule_count} poules</span>
                          </div>
                        ))}
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
                                    const qp          = queueByTeamId[t.team_id]
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
          {noDetail > 0 && !loading && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 8, border: '1px dashed var(--color-border)' }}>
              ⚠️ {noDetail} clubs zonder detail — scan via de vanger op www.hockey.nl
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

          {/* Poule queue */}
          {queue.total > 0 && (() => {
            const AGE_RE = /[JM][OZ](1[1-8])-/
            const ageOf  = sn => { const m = AGE_RE.exec(sn || ''); return m ? 'O' + m[1] : '?' }
            const ages   = ['O18','O16','O14','O12','O11']
            const byAge  = {}
            for (const p of queue.poules || []) {
              const ag = ageOf(p.short_name)
              if (!byAge[ag]) byAge[ag] = { missing: 0, stale: 0, captured: 0, items: [] }
              byAge[ag].items.push(p)
              if (p.stale)         byAge[ag].stale++
              else if (p.captured) byAge[ag].captured++
              else                 byAge[ag].missing++
            }
            const knownAges = ages.filter(a => byAge[a])
            const otherAges = Object.keys(byAge).filter(a => !ages.includes(a)).sort()
            const allAges   = [...knownAges, ...otherAges]

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
                          </div>
                          {agOpen && g.items.map(p => (
                            <div key={p.poule_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px 3px 18px', fontSize: 11, borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                              <span style={{ flex: 1, color: p.stale ? 'var(--color-text-muted)' : 'var(--color-text)', opacity: p.stale ? 0.6 : 1 }}>{p.team_name}</span>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>#{p.poule_id}</span>
                              {p.captured && !p.stale && <span style={{ color: 'var(--color-success)', fontSize: 10 }}>✓</span>}
                              {p.stale                && <span style={{ color: 'var(--color-warning)',  fontSize: 10 }}>↩</span>}
                              {(p.captured || p.stale) && (
                                <button onClick={() => resetPoule(p.poule_id)}
                                  style={{ fontSize: 10, padding: '1px 5px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 3, cursor: 'pointer' }}>reset</button>
                              )}
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
