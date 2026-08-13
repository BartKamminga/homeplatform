import { useState, useMemo } from 'react'
import { pill, useQueueCmd } from './queueShared.jsx'
import { deleteEmptyCompetitions } from '../api.js'

const _ghostBtn = { fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }

function isJeugd(comp) { return /O\d+/i.test(comp.name) }
const AGE_GROUP_ORDER = ['Senioren', 'Jeugd']

// Item 633: sortering op klasse-hiërarchie (Topklasse → ... → 7e Klasse → Afdeling)
function classRank(name) {
  if (/^Topklasse/i.test(name))  return 0
  if (/^Subtop/i.test(name))     return 1
  if (/^1e\s+Klas/i.test(name)) return 2
  if (/^2e\s+Klas/i.test(name)) return 3
  if (/^3e\s+Klas/i.test(name)) return 4
  if (/^4e\s+Klas/i.test(name)) return 5
  if (/^5e\s+Klas/i.test(name)) return 6
  if (/^6e\s+Klas/i.test(name)) return 7
  if (/^7e\s+Klas/i.test(name)) return 8
  if (/^Afdeling/i.test(name))   return 9
  return 99
}

export default function DiscoveryCompetities({ competitions, capturedPoules, allTeams, clubMap, expanded, toggle, loading, detailLoaded, season, onReload }) {
  const [compView,    setCompView]    = useState('district')
  const [herscanBusy, setHerscanBusy] = useState(false)
  const [herscanMsg,  setHerscanMsg]  = useState('')
  const [cleanupMsg,  setCleanupMsg]  = useState('')
  const { addSingleCmd, cmdBtn } = useQueueCmd()

  // Precomputed lookups — vervangen O(N) inline filters per render door O(1) lookup
  const capturedPoulesByComp = useMemo(() => {
    const m = {}
    for (const p of capturedPoules) {
      if (!m[p.competition_id]) m[p.competition_id] = []
      m[p.competition_id].push(p)
    }
    for (const arr of Object.values(m)) arr.sort((a, b) => a.name.localeCompare(b.name, 'nl'))
    return m
  }, [capturedPoules])

  const teamsByPoule = useMemo(() => {
    const m = {}
    for (const t of allTeams) {
      if (!t.recent_poule_id) continue
      if (!m[t.recent_poule_id]) m[t.recent_poule_id] = []
      m[t.recent_poule_id].push(t)
    }
    for (const arr of Object.values(m)) arr.sort((a, b) => a.short_name.localeCompare(b.short_name, 'nl'))
    return m
  }, [allTeams])

  async function handleHerscanAll() {
    const toScan = competitions.filter(c => c.hl_comp_id)
    if (!toScan.length) return
    setHerscanBusy(true); setHerscanMsg('')
    for (const c of toScan) {
      await addSingleCmd('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name })
    }
    setHerscanBusy(false)
    setHerscanMsg(`⟳ ${toScan.length} competities in herscan-queue gezet`)
    setTimeout(() => setHerscanMsg(''), 5000)
  }

  async function handleCleanupEmpty() {
    try {
      const r = await deleteEmptyCompetitions(season)
      setCleanupMsg(`${r.deleted} lege competities verwijderd`)
      setTimeout(() => setCleanupMsg(''), 4000)
      onReload()
    } catch (e) { setCleanupMsg('Fout: ' + e.message) }
  }

  // Competition entry: expandable → poules → teams
  // nested=true: toon class_name ipv volledige naam (naam staat al in parent)
  // distBadge: optioneel district-label (voor 'per competitie' view)
  function renderCompEntry(c, nested = false, distBadge = null) {
    const cKey    = 'comp_' + c.id
    const cOpen   = expanded.has(cKey)
    const cPoules = capturedPoulesByComp[c.id] || []
    return (
      <div key={c.id}>
        <div
          onClick={() => cPoules.length > 0 && toggle(cKey)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', paddingLeft: nested ? 4 : 2, fontSize: 12, cursor: cPoules.length > 0 ? 'pointer' : 'default', userSelect: 'none' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
            {cPoules.length > 0 ? (cOpen ? '▾' : '▸') : ''}
          </span>
          {!nested && <span style={{ flex: 1 }}>{c.name}</span>}
          {nested  && <span style={{ flex: 1, color: 'var(--color-text-muted)' }}>{c.class_name || c.name}</span>}
          {!nested && c.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{c.class_name}</span>}
          {distBadge && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic', opacity: 0.75 }}>📍 {distBadge}</span>}
          {c.hl_comp_id && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>#{c.hl_comp_id}</span>}
          <span style={pill(cPoules.length > 0 ? 'partial' : 'muted')}>{cPoules.length}/{c.poule_count} poules</span>
          {c.hl_comp_id && cmdBtn('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name }, '⟳ comp', '#b45309')}
        </div>

        {cOpen && (
          <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
            {cPoules.map(p => {
              const pKey   = 'poule_' + p.poule_id
              const pOpen  = expanded.has(pKey)
              const pTeams = teamsByPoule[p.poule_id] || []
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
  }

  // Groepsheader voor competities met dezelfde naam — kolom-layout (geen extra klik)
  function renderNameGroup(nm, nmComps, keyPrefix, showDistBadge = false) {
    if (nmComps.length === 1) {
      // item 636: in per-competitie view (showDistBadge) niet nested tonen — op zelfde niveau als multi-entry headers
      return renderCompEntry(nmComps[0], !showDistBadge, showDistBadge ? (nmComps[0].district || 'Onbekend') : null)
    }
    const ngKey    = `${keyPrefix}_${nm}`
    const ngOpen   = expanded.has(ngKey)
    const ngPoules = nmComps.reduce((s, c) => s + (capturedPoulesByComp[c.id]?.length ?? 0), 0)
    const ngTotal  = nmComps.reduce((s, c) => s + (c.poule_count || 0), 0)
    return (
      <div key={nm} style={{ marginBottom: 8 }}>
        {/* Naam-header — item 634: inklapbaar */}
        <div onClick={() => toggle(ngKey)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>{ngOpen ? '▾' : '▸'}</span>
          <span style={{ flex: 1 }}>{nm}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.6 }}>{nmComps.length}×</span>
          <span style={pill(ngPoules > 0 ? 'partial' : 'muted')}>{ngPoules}/{ngTotal} poules</span>
        </div>
        {/* Kolommen: één per district/klasse */}
        {ngOpen && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 10, marginTop: 3 }}>
          {nmComps.map(c => {
            const cPoules = capturedPoulesByComp[c.id] || []
            // per-competitie: kolom-label = district; per-district: kolom-label = class_name
            const colLabel = showDistBadge
              ? (c.district || 'Onbekend')
              : (c.class_name || c.district || 'Onbekend')
            const colSub   = showDistBadge ? c.class_name : null
            return (
              <div key={c.id} style={{
                flex: '1 1 140px', minWidth: 120, maxWidth: 260,
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                {/* Kolom-header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {colLabel}
                    </span>
                    {colSub && <span style={{ fontSize: 9, color: 'var(--color-text-muted)', opacity: 0.65 }}>{colSub}</span>}
                  </div>
                  {c.hl_comp_id && cmdBtn('get_competition_detail', { comp_id: c.hl_comp_id, label: c.name }, '⟳', 'var(--color-border)')}
                </div>
                {/* Poules in deze kolom */}
                {cPoules.length > 0 ? cPoules.map(p => {
                  const pKey   = 'poule_' + p.poule_id
                  const pOpen  = expanded.has(pKey)
                  const pTeams = teamsByPoule[p.poule_id] || []
                  return (
                    <div key={p.poule_id}>
                      <div
                        onClick={() => pTeams.length > 0 && toggle(pKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: pTeams.length > 0 ? 'pointer' : 'default', padding: '2px 0', userSelect: 'none' }}>
                        <span style={{ fontSize: 9, color: 'var(--color-text-muted)', width: 8, flexShrink: 0 }}>
                          {pTeams.length > 0 ? (pOpen ? '▾' : '▸') : '·'}
                        </span>
                        <span style={{ flex: 1 }}>{p.name}</span>
                        {pTeams.length > 0 && <span style={pill('ok')}>{pTeams.length}</span>}
                        {pTeams[0]?.team_id && cmdBtn('get_poule', { poule_id: p.poule_id, team_id: pTeams[0].team_id, label: p.name }, '+ cmd', 'var(--color-border)')}
                      </div>
                      {pOpen && (
                        <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
                          {pTeams.map(t => (
                            <div key={t.team_id} style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '1px 0' }}>
                              <span style={{ fontWeight: 500 }}>{t.short_name}</span>
                              {clubMap[t.club_external_id] && <span style={{ opacity: 0.6 }}> · {clubMap[t.club_external_id]}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }) : (
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.5, fontStyle: 'italic' }}>
                    {c.poule_count ? `${c.poule_count} poules (nog niet gevangen)` : 'Geen poules'}
                  </div>
                )}
              </div>
            )
          })}
        </div>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleHerscanAll} disabled={herscanBusy} style={{ ..._ghostBtn, opacity: herscanBusy ? 0.5 : 1 }}>
          {herscanBusy ? '…' : '⟳ Herscan alle'}
        </button>
        <button onClick={handleCleanupEmpty} style={_ghostBtn}>🗑 Lege opruimen</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[['district', '📍 Per district'], ['competitie', '🏆 Per competitie']].map(([v, label]) => (
            <button key={v} onClick={() => setCompView(v)} style={{
              ..._ghostBtn,
              ...(compView === v ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : {}),
            }}>{label}</button>
          ))}
        </div>
      </div>

      {herscanMsg && <p style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600, margin: 0 }}>{herscanMsg}</p>}
      {cleanupMsg && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>{cleanupMsg}</p>}

      {/* Boom: VE/ZA → Senioren/Jeugd → [district → naam] of [naam → district] */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {['VE', 'ZA', ''].map(ht => {
          const htGroup = competitions.filter(c =>
            ht === '' ? (!c.hockey_type || (c.hockey_type !== 'VE' && c.hockey_type !== 'ZA')) : c.hockey_type === ht
          )
          if (!htGroup.length) return null
          const htLabel = ht === 'VE' ? '🏑 Veldhockey' : ht === 'ZA' ? '🏒 Zaalhockey' : '⚪ Onbekend type'
          const byAge = {
            Senioren: htGroup.filter(c => !isJeugd(c)),
            Jeugd:    htGroup.filter(c =>  isJeugd(c)),
          }

          return (
            <div key={ht || 'other'}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em', marginBottom: 4, marginTop: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 3 }}>
                {htLabel}
              </div>

              {AGE_GROUP_ORDER.map(ag => {
                const ageGroup = byAge[ag]
                if (!ageGroup.length) return null

                const agHeader = (
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 2px 2px', opacity: 0.7 }}>
                    {ag} ({ageGroup.length})
                  </div>
                )

                // ── Per district ─────────────────────────────────────
                if (compView === 'district') {
                  const byDist = {}
                  for (const c of ageGroup) {
                    const d = c.district || 'Onbekend'
                    if (!byDist[d]) byDist[d] = []
                    byDist[d].push(c)
                  }
                  const districts = Object.keys(byDist).sort((a, b) =>
                    a === 'Onbekend' ? 1 : b === 'Onbekend' ? -1 : a.localeCompare(b, 'nl')
                  )
                  return (
                    <div key={ag}>
                      {agHeader}
                      {districts.map(dist => {
                        const distKey  = `dist_${ht}_${ag}_${dist}`
                        const distOpen = expanded.has(distKey)
                        const byName = {}
                        for (const c of byDist[dist]) {
                          if (!byName[c.name]) byName[c.name] = []
                          byName[c.name].push(c)
                        }
                        // item 633: klasse-hiërarchie sortering
                        const names = Object.keys(byName).sort((a, b) => {
                          const d = classRank(a) - classRank(b)
                          return d !== 0 ? d : a.localeCompare(b, 'nl')
                        })
                        return (
                          <div key={dist} style={{ marginBottom: 6 }}>
                            {/* item 632: district inklapbaar */}
                            <div onClick={() => toggle(distKey)} style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '3px 2px 2px', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid var(--color-border)', cursor: 'pointer', userSelect: 'none' }}>
                              <span style={{ opacity: 0.4, fontSize: 9, width: 8 }}>{distOpen ? '▾' : '▸'}</span>
                              <span style={{ opacity: 0.5 }}>📍</span>
                              <span style={{ fontStyle: 'italic' }}>{dist}</span>
                              <span style={{ opacity: 0.45 }}>({byDist[dist].length})</span>
                            </div>
                            {distOpen && !detailLoaded && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 2px', fontStyle: 'italic' }}>
                                Laden…
                              </div>
                            )}
                            {distOpen && detailLoaded && names.map(nm => renderNameGroup(nm, byName[nm], `ng_${dist}`))}
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                // ── Per competitie ────────────────────────────────────
                const byName = {}
                for (const c of ageGroup) {
                  if (!byName[c.name]) byName[c.name] = []
                  byName[c.name].push(c)
                }
                // item 633: klasse-hiërarchie sortering
                const names = Object.keys(byName).sort((a, b) => {
                  const d = classRank(a) - classRank(b)
                  return d !== 0 ? d : a.localeCompare(b, 'nl')
                })
                return (
                  <div key={ag}>
                    {agHeader}
                    {names.map(nm => {
                      // item 636: per-competitie sortering binnen groep: district primair
                      const nmComps = [...byName[nm]].sort((a, b) =>
                        (a.district || '').localeCompare(b.district || '', 'nl') ||
                        (a.class_name || '').localeCompare(b.class_name || '', 'nl')
                      )
                      return renderNameGroup(nm, nmComps, 'ngv', true)
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}

        {!loading && competitions.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Geen competities gevonden voor {season}
          </div>
        )}
      </div>
    </div>
  )
}
