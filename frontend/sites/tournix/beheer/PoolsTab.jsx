import { useState, useEffect } from 'react'
import { getMatches, getFields, assignTeamPool, autoAssignPools, updateTournamentPools } from '../api.js'
import { noTid } from './styles.js'

export default function PoolsTab({ tid, active, pools, teams, stage, loadPools, loadTeams, onRefresh }) {
  const [matches,   setMatches]   = useState([])
  const [fieldMap,  setFieldMap]  = useState({})
  const [assigning, setAssigning] = useState(false)
  const locked = stage !== 'inregel'

  useEffect(() => {
    if (!tid) return
    getMatches(tid).then(setMatches).catch(() => {})
    getFields(tid).then(f => setFieldMap(Object.fromEntries(f.map(x => [x.id, x])))).catch(() => {})
  }, [tid])

  async function handlePoolSettings(num, type) {
    await updateTournamentPools(tid, num, type)
    await onRefresh()
  }

  async function handleAutoAssign() {
    setAssigning(true)
    try { await autoAssignPools(tid); await loadPools(); await loadTeams() }
    finally { setAssigning(false) }
  }

  async function handleAssignTeam(teamId, poolId) {
    await assignTeamPool(teamId, poolId || null)
    await loadTeams()
  }

  if (!tid) return <p style={noTid}>Selecteer eerst een toernooi.</p>
  if (!active) return <p style={noTid}>Geen toernooi geselecteerd.</p>

  const teamsByPool = {}
  for (const p of pools) teamsByPool[p.id] = []
  const unassigned = []
  for (const t of teams) {
    if (t.pool_id && teamsByPool[t.pool_id]) teamsByPool[t.pool_id].push(t)
    else unassigned.push(t)
  }
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {locked && (
        <div style={{ padding: '8px 14px', background: 'var(--color-warning)', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
          {stage === 'productie' ? 'Productie — structuur is vergrendeld' : 'Test-modus — alleen simuleren'}
        </div>
      )}

      {/* Instellingen */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 8,
        opacity: locked ? 0.5 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10 }}>INSTELLINGEN</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text)', minWidth: 100 }}>Aantal poules</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <button key={n} onClick={() => handlePoolSettings(n, active.pool_type)}
                style={{ width: 32, height: 32, borderRadius: 6, fontFamily: 'inherit',
                  border: active.num_pools === n ? 'none' : '1px solid var(--color-border)',
                  background: active.num_pools === n ? 'var(--color-primary)' : 'transparent',
                  color: active.num_pools === n ? '#fff' : 'var(--color-text-muted)',
                  cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text)', minWidth: 100 }}>Speelschema</span>
          {[['half','Enkel (1×)'],['vol','Dubbel (heen+terug)']].map(([val, label]) => (
            <button key={val} onClick={() => handlePoolSettings(active.num_pools, val)}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, fontFamily: 'inherit',
                border: active.pool_type === val ? 'none' : '1px solid var(--color-border)',
                background: active.pool_type === val ? 'var(--color-primary)' : 'transparent',
                color: active.pool_type === val ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        <button onClick={handleAutoAssign} disabled={assigning} style={{
          fontSize: 13, padding: '8px 16px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
          background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600,
          opacity: assigning ? 0.6 : 1 }}>
          {assigning ? 'Indelen…' : '⚡ Automatische indeling'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 10 }}>
          Herverdeelt alle teams gelijkmatig
        </span>
      </div>

      {/* Poulekaarten */}
      {pools.map(pool => {
        const poolTeams   = teamsByPool[pool.id] ?? []
        const poolMatches = matches.filter(m =>
          m.match_type !== 'ko' &&
          teamMap[m.team_a_id]?.pool_id === pool.id &&
          teamMap[m.team_b_id]?.pool_id === pool.id
        )
        return (
          <div key={pool.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-primary)', color: '#fff' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{pool.name}</span>
              <span style={{ fontSize: 12, opacity: 0.8, marginLeft: 10 }}>
                {poolTeams.length} teams · {poolMatches.length} wedstrijden
              </span>
            </div>

            <div style={{ padding: '10px 14px', borderBottom: poolMatches.length ? '1px solid var(--color-border)' : 'none',
              opacity: locked ? 0.6 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '0.05em' }}>TEAMS</div>
              {poolTeams.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen teams ingedeeld</div>
                : poolTeams.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {t.color && <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: 13 }}>{t.name}</span>
                      <select value={t.pool_id || ''} onChange={e => handleAssignTeam(t.id, e.target.value)}
                        style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--color-border)',
                          borderRadius: 4, background: 'var(--color-background)', color: 'var(--color-text)' }}>
                        <option value="">— geen —</option>
                        {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  ))
              }
            </div>

            {poolMatches.length > 0 && (
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '0.05em' }}>WEDSTRIJDEN</div>
                {poolMatches.map(m => {
                  const ta = teamMap[m.team_a_id], tb = teamMap[m.team_b_id]
                  const done = m.status === 'finished'
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 13 }}>
                      <span style={{ flex: 1, textAlign: 'right', fontWeight: 500 }}>{ta?.name ?? '—'}</span>
                      <span style={{ minWidth: 52, textAlign: 'center', fontWeight: 700,
                        color: done ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: 12 }}>
                        {done ? `${m.score_a}–${m.score_b}` : 'vs'}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{tb?.name ?? '—'}</span>
                      {m.field_id && fieldMap[m.field_id] && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{fieldMap[m.field_id].name}</span>
                      )}
                      {m.round != null && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4 }}>R{m.round}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {unassigned.length > 0 && (
        <div style={{ padding: '12px 14px', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 12,
          opacity: locked ? 0.6 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
            ZONDER POULE ({unassigned.length})
          </div>
          {unassigned.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {t.color && <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 13 }}>{t.name}</span>
              {pools.length > 0 && (
                <select value="" onChange={e => handleAssignTeam(t.id, e.target.value)}
                  style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--color-border)',
                    borderRadius: 4, background: 'var(--color-background)', color: 'var(--color-text)' }}>
                  <option value="">Wijs toe…</option>
                  {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
