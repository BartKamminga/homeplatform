import { useState, useEffect } from 'react'
import { getPhases, getPhaseStandings } from '../../api.js'
import { card, cardLabel, errorBanner } from '../styles.js'

function StandingsTable({ standings }) {
  if (!standings?.length) {
    return <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>Geen standen beschikbaar.</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '2px 6px 4px 0', fontWeight: 400, width: 20 }}>#</th>
            <th style={{ textAlign: 'left', padding: '2px 6px 4px 0', fontWeight: 400 }}>Team</th>
            <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>G</th>
            <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>W</th>
            <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>G</th>
            <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 28 }}>V</th>
            <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 400, width: 44 }}>Doel</th>
            <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 700, width: 32 }}>Pt</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={i} style={{
              borderTop: '1px solid var(--color-border)',
              background: i === 0 ? 'var(--color-primary)0a' : 'transparent',
            }}>
              <td style={{ padding: '3px 6px 3px 0', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
              <td style={{ padding: '3px 6px 3px 0', fontWeight: i === 0 ? 700 : 400, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.team_name || row.name || '?'}
              </td>
              <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>
                {row.played ?? ((row.won ?? 0) + (row.drawn ?? 0) + (row.lost ?? 0))}
              </td>
              <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>{row.won ?? 0}</td>
              <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>{row.drawn ?? 0}</td>
              <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>{row.lost ?? 0}</td>
              <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums' }}>
                {row.gf ?? 0}–{row.ga ?? 0}
              </td>
              <td style={{ textAlign: 'right', padding: '3px 4px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{row.pts ?? row.points ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StandenTab({ tournament }) {
  const [phases,   setPhases]   = useState([])
  const [data,     setData]     = useState({})
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  useEffect(() => {
    setLoading(true)
    getPhases(tournament.id)
      .then(async ps => {
        setPhases(ps)
        const entries = await Promise.all(
          ps.map(p => getPhaseStandings(p.id).then(s => [p.id, s]).catch(() => [p.id, []]))
        )
        setData(Object.fromEntries(entries))
      })
      .catch(() => setErr('Laden mislukt'))
      .finally(() => setLoading(false))
  }, [tournament.id])

  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 20 }}>Laden…</div>
  if (err)     return <div style={{ ...errorBanner, margin: 8 }}>{err}</div>

  if (phases.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 28 }}>
        Nog geen fases aangemaakt.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {phases.map(phase => {
        const standings = data[phase.id]
        const pools = phase.pools || []
        return (
          <div key={phase.id}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{phase.name}</div>
            {pools.length > 0 ? (
              pools.map(pool => {
                const poolRows = (standings || []).filter(r => r.pool_id === pool.id || !r.pool_id)
                return (
                  <div key={pool.id} style={{ marginBottom: 14 }}>
                    <div style={cardLabel}>{pool.name}</div>
                    <StandingsTable standings={poolRows.length ? poolRows : standings} />
                  </div>
                )
              })
            ) : (
              <StandingsTable standings={standings} />
            )}
          </div>
        )
      })}
    </div>
  )
}
