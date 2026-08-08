import { api } from '@core/api.js'
import { pill } from '../queueShared.jsx'

const AGE_RE = /[JMjm][OZoz](\d+)-/
const ageOf  = sn => { const m = AGE_RE.exec(sn || ''); return m ? 'O' + m[1] : '?' }

export default function PouleQueueSection({ queue, qFilter, allTeams, showWaiting, expanded, queueOpen, setQueueOpen, toggle, onResetPoule, cmdOps, onFillClubs, clubsFilling }) {
  const { addSingleCmd, cmdAdding } = cmdOps

  const allAgesInQueue = [...new Set(
    (queue.poules || []).filter(p => p.has_poule !== false).map(p => ageOf(p.short_name)).filter(a => a !== '?')
  )].sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)))

  const byAge = {}
  for (const p of queue.poules || []) {
    const ag = ageOf(p.short_name)
    if (!byAge[ag]) byAge[ag] = { missing: 0, stale: 0, captured: 0, waiting: 0, items: [], waitingItems: [] }
    if (p.has_poule === false) {
      if (showWaiting) { byAge[ag].waiting++; byAge[ag].waitingItems.push(p) }
    } else {
      byAge[ag].items.push(p)
      if (p.stale)         byAge[ag].stale++
      else if (p.captured) byAge[ag].captured++
      else                 byAge[ag].missing++
    }
  }

  const knownAges  = allAgesInQueue.filter(a => byAge[a])
  const otherAges  = Object.keys(byAge).filter(a => !allAgesInQueue.includes(a)).sort()
  const allAgesRaw = [...knownAges, ...otherAges]
  const allAges    = qFilter.age_groups.length > 0
    ? allAgesRaw.filter(a => qFilter.age_groups.includes(a))
    : allAgesRaw

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
          {queue.waiting > 0 && onFillClubs && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px 10px',
              borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>
                ⏳ {queue.waiting} teams wachten op club-scan
              </span>
              <button onClick={onFillClubs} disabled={clubsFilling} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 6, fontFamily: 'inherit', cursor: clubsFilling ? 'default' : 'pointer',
                border: '1px solid var(--color-primary)', background: 'transparent',
                color: 'var(--color-primary)', opacity: clubsFilling ? 0.5 : 1,
              }}>{clubsFilling ? 'Bezig…' : '+ Clubs scannen'}</button>
            </div>
          )}
          {allAges.map(ag => {
            const g      = byAge[ag]
            const agOpen = expanded.has('q_' + ag)
            const allCap = g.missing === 0 && g.stale === 0
            return (
              <div key={ag}>
                <div onClick={() => toggle('q_' + ag)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 2px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10 }}>{agOpen ? '▾' : '▸'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 32, color: allCap ? 'var(--color-success)' : 'var(--color-text)' }}>{ag}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>{g.items.length} teams</span>
                  {g.missing  > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{g.missing} open</span>}
                  {g.stale    > 0 && <span style={{ fontSize: 10, color: 'var(--color-warning)', marginLeft: 4 }}>{g.stale} oud</span>}
                  {g.captured > 0 && <span style={{ fontSize: 10, color: 'var(--color-success)', marginLeft: 4 }}>✓ {g.captured}</span>}
                  {g.waiting  > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4, opacity: 0.6 }}>⏳ {g.waiting}</span>}
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
                        <button onClick={() => onResetPoule(p.poule_id)}
                          style={{ fontSize: 10, padding: '1px 5px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 3, cursor: 'pointer' }}>reset</button>
                      )}
                      {!p.captured && p.poule_id && p.team_id && (
                        <button
                          disabled={!!addState}
                          onClick={() => addSingleCmd('get_poule', { poule_id: p.poule_id, team_id: p.team_id, label: p.team_name || p.short_name })}
                          style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, cursor: addState ? 'default' : 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                            background: 'none',
                            color: addState === 'added' ? 'var(--color-success)' : addState === 'exists' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                            transition: 'color .2s, border-color .2s' }}>
                          {addState === 'adding' ? '…' : addState === 'added' ? '✓ toegevoegd' : addState === 'exists' ? '⚠ al in queue' : '+ cmd'}
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
}
