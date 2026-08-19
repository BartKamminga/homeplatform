import { useState, useMemo } from 'react'
import { deleteEmptyCompetitions, deletePoule } from '../../api.js'
import { ghostBtnSm } from '../styles.js'
import { useQueueCmd } from '../queueShared.jsx'
import { isJeugd, AGE_GROUP_ORDER, normalizeDistrict, classRank } from './discoveryHelpers.js'
import NameGroup from './NameGroup.jsx'

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
      // item 728: geen season-scoping meer - een lege competitie is leeg ongeacht
      // welk seizoen er nu geselecteerd staat, anders blijven oudere lege
      // competities onopgemerkt liggen.
      const r = await deleteEmptyCompetitions()
      setCleanupMsg(`${r.deleted} lege competities verwijderd (alle seizoenen)`)
      setTimeout(() => setCleanupMsg(''), 4000)
      onReload()
    } catch (e) { setCleanupMsg('Fout: ' + e.message) }
  }

  async function handleDeletePoule(e, poule) {
    e.stopPropagation()
    if (!window.confirm(`Poule "${poule.name}" (#${poule.poule_id}) verwijderen? Matches/standen gaan mee, kan opnieuw ontdekt worden bij een volgende scan.`)) return
    try {
      await deletePoule(poule.poule_id)
      onReload()
    } catch (e2) { setCleanupMsg('Fout: ' + e2.message); setTimeout(() => setCleanupMsg(''), 5000) }
  }

  const nameGroupProps = {
    expanded, toggle, capturedPoulesByComp, teamsByPoule, cmdBtn, clubMap,
    onDeletePoule: handleDeletePoule,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleHerscanAll} disabled={herscanBusy} style={{ ...ghostBtnSm, opacity: herscanBusy ? 0.5 : 1 }}>
          {herscanBusy ? '…' : '⟳ Herscan alle'}
        </button>
        <button onClick={handleCleanupEmpty} style={ghostBtnSm}>🗑 Lege opruimen</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[['district', '📍 Per district'], ['competitie', '🏆 Per competitie']].map(([v, label]) => (
            <button key={v} onClick={() => setCompView(v)} style={{
              ...ghostBtnSm,
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
                    const d = normalizeDistrict(c.district || 'Onbekend')
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
                            {distOpen && detailLoaded && names.map(nm => (
                              <NameGroup key={nm} nm={nm} nmComps={byName[nm]} keyPrefix={`ng_${dist}`} {...nameGroupProps} />
                            ))}
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
                      return <NameGroup key={nm} nm={nm} nmComps={nmComps} keyPrefix="ngv" showDistBadge {...nameGroupProps} />
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
