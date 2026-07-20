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

export default function DiscoveryTab() {
  const [clubs,    setClubs]    = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [queue,    setQueue]    = useState({ total: 0, captured: 0, missing: 0, poules: [] })
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState(new Set())

  function load() {
    setLoading(true); setError('')
    Promise.all([
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/youth-queue'),
    ]).then(([clubsRes, teamsRes, queueRes]) => {
      setClubs(clubsRes.clubs || [])
      setAllTeams(teamsRes.teams || [])
      setQueue(queueRes)
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

  // Lookup structures
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
      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={statBox}><span style={statNum}>{clubs.length}</span><span style={statLbl}>clubs</span></div>
        <div style={statBox}><span style={statNum}>{detailLoaded}</span><span style={statLbl}>detail geladen</span></div>
        <div style={statBox}><span style={statNum}>{youthCount}</span><span style={statLbl}>jeugdteams</span></div>
        <div style={{ ...statBox, borderColor: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-border)' }}>
          <span style={{ ...statNum, color: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
            {queue.captured}/{queue.total}
          </span>
          <span style={statLbl}>poules gevangen</span>
        </div>
        <button onClick={load} style={{ ...ghostBtn, alignSelf: 'center' }}>↻ Vernieuwen</button>
      </div>

      {error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      {noDetail > 0 && !loading && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 8, border: '1px dashed var(--color-border)' }}>
          ⚠️ {noDetail} clubs zonder detail — scan via de vanger op www.hockey.nl
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

        const byCategory = {}
        for (const t of teams) {
          if (!byCategory[t.category_group_name]) byCategory[t.category_group_name] = []
          byCategory[t.category_group_name].push(t)
        }
        const cats = sortCats(Object.keys(byCategory))

        return (
          <div key={c.external_id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header */}
            <div onClick={() => toggle(c.external_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12, flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 80 }}>{c.friendly_name || c.name}</span>
              {c.city && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.city}</span>}
              <span style={pill(c.detail_loaded ? 'ok' : 'muted')}>{c.detail_loaded ? '✓ detail' : '– geen detail'}</span>
              {teams.length > 0 && <span style={pill('muted')}>{teams.length} teams</span>}
              {pStats && <span style={pill(pVar)}>{cap}/{tot} poules</span>}
            </div>

            {/* Detail */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Contactinfo */}
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

                {/* Teams per categorie */}
                {cats.length > 0 ? cats.map(cat => {
                  const catTeams = [...byCategory[cat]].sort((a, b) => a.short_name.localeCompare(b.short_name, 'nl'))
                  return (
                    <div key={cat}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                        {cat} <span style={{ fontWeight: 400 }}>({catTeams.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {catTeams.map(t => {
                          const qp         = queueByTeamId[t.team_id]
                          const hasCaptured = qp && qp.captured
                          const hasPoule    = !!t.recent_poule_id
                          const v           = hasCaptured ? 'ok' : hasPoule ? 'partial' : 'muted'
                          return (
                            <span key={t.team_id} style={pill(v)}
                              title={t.name + (t.recent_poule_id ? ' · poule ' + t.recent_poule_id : ' · geen poule')}>
                              {t.short_name}
                              {hasPoule && <span style={{ opacity: 0.65 }}>{hasCaptured ? '✓' : '○'}</span>}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                }) : (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                    Geen teams geladen — scan deze club via de vanger
                  </p>
                )}

                {/* Externe ID */}
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
