import React from 'react'
import { pct, pc } from '../../lib/utils'

export default function NKChances({ myTeam, results, baseResults, N, o16, hasLocks }) {
  if (!myTeam || !results) return null
  const getChances = (res) => {
    if (!res) return null
    if (o16) {
      const f = res.fin[myTeam]
      return f ? { kf: pct(f.kf, N), hf: pct(f.hf, N), fin: pct(f.finalist, N), p1: pct(f.p1, N) } : null
    } else {
      const f = res.fin[myTeam]
      return f ? { hf: pct(f.sfReach, N), fin: pct(f.finalist, N), p1: pct(f.p1, N), podium: pct(f.p1 + f.p2 + f.p3, N) } : null
    }
  }
  const current = getChances(results), baseline = getChances(baseResults)
  if (!current) return null
  const diff = (cur, base) => {
    if (!hasLocks || base == null || cur == null) return null
    const d = cur - base
    if (d === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> (=)</span>
    return <span style={{ color: d > 0 ? 'var(--win)' : 'var(--lose)', fontSize: 10, fontWeight: 600 }}> ({d > 0 ? '+' : ''}{d}%)</span>
  }
  const Row = ({ label, val, baseVal, bold, gold }) => (
    <tr style={gold ? { background: 'var(--bg-gold)' } : {}}>
      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: bold ? 600 : 400 }}>{label}</td>
      <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: "'DM Mono',monospace", fontWeight: bold ? 600 : 400 }} className={pc(val, 30, 15)}>
        {val}%{diff(val, baseVal)}
      </td>
    </tr>
  )
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">NK kansen {myTeam}</div>
      <table><tbody>
        {o16 ? <>
          <Row label="Kwartfinale" val={current.kf} baseVal={baseline?.kf} />
          <Row label="Halve finale" val={current.hf} baseVal={baseline?.hf} />
          <Row label="Finale" val={current.fin} baseVal={baseline?.fin} />
          <Row label="🥇 Kampioen" val={current.p1} baseVal={baseline?.p1} bold gold />
        </> : <>
          <Row label="Halve finale" val={current.hf} baseVal={baseline?.hf} />
          <Row label="Finale" val={current.fin} baseVal={baseline?.fin} />
          <Row label="🥇 Kampioen" val={current.p1} baseVal={baseline?.p1} bold gold />
          <Row label="Podium (top 3)" val={current.podium} baseVal={baseline?.podium} />
        </>}
      </tbody></table>
    </div>
  )
}
