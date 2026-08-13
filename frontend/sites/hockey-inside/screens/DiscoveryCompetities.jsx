import { useState } from 'react'
import { pill, useQueueCmd } from './queueShared.jsx'
import { deleteEmptyCompetitions } from '../api.js'

const _ghostBtn = { fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }

function isJeugd(comp) { return /O\d+/i.test(comp.name) }
const AGE_GROUP_ORDER = ['Senioren', 'Jeugd']

export default function DiscoveryCompetities({ competitions, capturedPoules, allTeams, clubMap, expanded, toggle, loading, season, onReload }) {
  const [compView,    setCompView]    = useState('district')
  const [herscanBusy, setHerscanBusy] = useState(false)
  const [herscanMsg,  setHerscanMsg]  = useState('')
  const [cleanupMsg,  setCleanupMsg]  = useState('')
  const { addSingleCmd, cmdBtn } = useQueueCmd()

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
    const cPoules = capturedPoules
      .filter(p => p.competition_id === c.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
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
  }

  // Groepsheader voor competities met dezelfde naam (meerdere klassen)
  function renderNameGroup(nm, nmComps, keyPrefix, showDistBadge = false) {
    if (nmComps.length === 1) {
      return showDistBadge
        ? renderCompEntry(nmComps[0], true, nmComps[0].district || 'Onbekend')
        : renderCompEntry(nmComps[0])
    }
    const ngKey    = `${keyPrefix}_${nm}`
    const ngOpen   = expanded.has(ngKey)
    const ngPoules = nmComps.reduce((s, c) => s + capturedPoules.filter(p => p.competition_id === c.id).length, 0)
    const ngTotal  = nmComps.reduce((s, c) => s + (c.poule_count || 0), 0)
    return (
      <div key={nm}>
        <div
          onClick={() => toggle(ngKey)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12, cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
            {ngOpen ? '▾' : '▸'}
          </span>
          <span style={{ flex: 1 }}>{nm}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.6 }}>{nmComps.length}×</span>
          <span style={pill(ngPoules > 0 ? 'partial' : 'muted')}>{ngPoules}/{ngTotal} poules</span>
        </div>
        {ngOpen && (
          <div style={{ marginLeft: 14, borderLeft: '2px solid var(--color-border)', paddingLeft: 6, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {nmComps.map(c => showDistBadge
              ? renderCompEntry(c, true, c.district || 'Onbekend')
              : renderCompEntry(c, true)
            )}
          </div>
        )}
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
                        const byName = {}
                        for (const c of byDist[dist]) {
                          if (!byName[c.name]) byName[c.name] = []
                          byName[c.name].push(c)
                        }
                        const names = Object.keys(byName).sort((a, b) => a.localeCompare(b, 'nl'))
                        return (
                          <div key={dist} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '3px 2px 2px', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
                              <span style={{ opacity: 0.5 }}>📍</span>
                              <span style={{ fontStyle: 'italic' }}>{dist}</span>
                              <span style={{ opacity: 0.45 }}>({byDist[dist].length})</span>
                            </div>
                            {names.map(nm => renderNameGroup(nm, byName[nm], `ng_${dist}`))}
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
                const names = Object.keys(byName).sort((a, b) => a.localeCompare(b, 'nl'))
                return (
                  <div key={ag}>
                    {agHeader}
                    {names.map(nm => {
                      const nmComps = [...byName[nm]].sort((a, b) =>
                        (a.class_name || '').localeCompare(b.class_name || '', 'nl') ||
                        (a.district || '').localeCompare(b.district || '', 'nl')
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
