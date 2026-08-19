import { useState } from 'react'
import { pill, useQueueCmd } from './queueShared.jsx'

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

export default function DiscoveryClubs({ clubs, teamsByClub, poulesByClub, queueByPouleId, expanded, toggle, loading }) {
  const [clubSearch, setClubSearch] = useState('')
  const { cmdBtn } = useQueueCmd()

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

  const renderItems = (() => {
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
      <input
        type="search"
        value={clubSearch}
        onChange={e => setClubSearch(e.target.value)}
        placeholder={`Zoek in ${clubs.length} clubs…`}
        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
      />

      {renderItems.map(item => {
        if (item.type === 'header') {
          return (
            <div key={'h-' + item.district} style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '6px 2px 2px', marginTop: 2 }}>
              {item.district} <span style={{ fontWeight: 400 }}>({item.count})</span>
            </div>
          )
        }

        const c      = item.club
        const teams  = teamsByClub[c.external_id] || []
        const pStats = poulesByClub[c.external_id]
        const cap    = pStats ? pStats.captured : 0
        const tot    = pStats ? pStats.total    : 0
        const pVar   = tot === 0 ? 'muted' : cap === tot ? 'ok' : cap > 0 ? 'partial' : 'muted'
        const isOpen = expanded.has(c.external_id)

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
              {cmdBtn('scan_club', { external_id: c.external_id, label: c.friendly_name || c.name }, '⟳ herscan', 'var(--color-border)')}
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
