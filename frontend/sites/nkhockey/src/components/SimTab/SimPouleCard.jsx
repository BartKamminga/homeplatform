import React from 'react'
import { fmtMatchDate, getTeamForm } from '../../lib/utils'
import FormBadge from '../common/FormBadge'

export default function SimPouleCard({ title, headerClass, teams, basePts, baseDs, rounds, locks, myTeam, onToggle, onSetRound, onPredict, onPredictAll, hideStandings, matchesPlayed, showForm, showPlayed, showMatches }) {
  const pts = {}, ds = {}
  teams.forEach((t, i) => { pts[t] = basePts[i] || 0; ds[t] = baseDs[i] || 0 })
  for (const round of rounds) {
    for (const m of round.matches) {
      const raw = locks[m.lockKey]
      if (!raw) continue
      const lock = typeof raw === 'string' ? { result: raw } : raw
      if (lock.result === 'W') pts[m.h] = (pts[m.h] || 0) + 3
      else if (lock.result === 'D') { pts[m.h] = (pts[m.h] || 0) + 1; pts[m.a] = (pts[m.a] || 0) + 1 }
      else if (lock.result === 'L') pts[m.a] = (pts[m.a] || 0) + 3
      if (lock.scoreH != null && lock.scoreA != null) {
        ds[m.h] = (ds[m.h] || 0) + lock.scoreH - lock.scoreA
        ds[m.a] = (ds[m.a] || 0) + lock.scoreA - lock.scoreH
      }
    }
  }
  const standings = teams.map((t, i) => ({ team: t, pts: pts[t] || 0, ds: ds[t] || 0, origRank: i }))
    .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.ds !== a.ds ? b.ds - a.ds : a.origRank - b.origRank)
  const hasAnyBase = basePts.some(p => p > 0)

  const totalRounds = rounds.length
  const completedRounds = rounds.filter(r => r.matches.every(m => locks[m.lockKey])).length
  const openRounds = totalRounds - completedRounds

  // Build combined matches: played + locked predictions (for form calculation)
  const allMatches = matchesPlayed ? [...matchesPlayed] : []
  for (const round of rounds) {
    for (const m of round.matches) {
      const raw = locks[m.lockKey]
      if (!raw) continue
      const lock = typeof raw === 'string' ? { result: raw } : raw
      const scoreH = lock.scoreH != null ? lock.scoreH : (lock.result === 'W' ? 1 : lock.result === 'D' ? 0 : 0)
      const scoreA = lock.scoreA != null ? lock.scoreA : (lock.result === 'L' ? 1 : lock.result === 'D' ? 0 : 0)
      allMatches.push({ home: m.h, away: m.a, score: `${scoreH}-${scoreA}`, round: round.roundNum + 100 })
    }
  }

  return (
    <div className="card">
      <div className={`card-header ${headerClass || ''}`} style={{ justifyContent: 'space-between' }}>
        <span>{title}<span className="played-count" style={{ marginLeft: 8 }}>{openRounds > 0 ? `nog ${openRounds} ronde${openRounds > 1 ? 's' : ''}` : '✓ klaar'}</span></span>
        {openRounds > 0 && <div className="whatif-preset-sm" onClick={onPredictAll} title="Voorspel alle resterende wedstrijden" style={{ background: 'var(--btn-predict-bg)', color: 'var(--btn-predict-text)', fontStyle: 'italic' }}>✦</div>}
      </div>

      {!hideStandings && <table><tbody>
        {standings.map((s, i) => {
          const isMy = s.team === myTeam
          const form = getTeamForm(s.team, allMatches)
          // Calculate W-G-V from all matches
          let w = 0, d = 0, l = 0
          if (showPlayed && allMatches.length > 0) {
            for (const m of allMatches) {
              if (m.home !== s.team && m.away !== s.team) continue
              const [sh, sa] = (m.score || '').split('-').map(Number)
              if (isNaN(sh) || isNaN(sa)) continue
              if (m.home === s.team) { if (sh > sa) w++; else if (sh === sa) d++; else l++ }
              else { if (sa > sh) w++; else if (sh === sa) d++; else l++ }
            }
          }
          return (
            <tr key={s.team} className={isMy ? 'row-my' : ''}>
              <td className="td-rank">{i + 1}</td>
              <td className="td-name" style={{ fontWeight: isMy ? 600 : 400 }}>{s.team}</td>
              <td className="td-pts">{s.pts > 0 ? s.pts : hasAnyBase ? '0' : '-'}</td>
              <td className="td-ds" style={{ color: s.ds >= 0 ? 'var(--win)' : 'var(--lose)' }}>{hasAnyBase ? (s.ds >= 0 ? '+' : '') + s.ds : ''}</td>
              {showPlayed && (w + d + l) > 0 && <td className="td-wdl">{w}-{d}-{l}</td>}
              {showForm && form.length > 0 && <td className="td-form"><FormBadge form={form} /></td>}
            </tr>
          )
        })}
      </tbody></table>}

      {/* Played matches (toggle via showMatches) */}
      {showMatches && matchesPlayed && matchesPlayed.length > 0 && (() => {
        const playedRounds = {}
        matchesPlayed.forEach(m => { const r = m.round || '?'; if (!playedRounds[r]) playedRounds[r] = []; playedRounds[r].push(m) })
        const sortedRounds = Object.keys(playedRounds).sort((a, b) => parseInt(a) - parseInt(b))
        return sortedRounds.map(r => {
          const ms = playedRounds[r]
          const dateStr = fmtMatchDate(ms[0] && ms[0].date)
          return (
            <div key={`played_${r}`}>
              <div className="round-header round-header-played">
                <span>Ronde {r}{dateStr ? ` · ${dateStr}` : ''}</span>
              </div>
              {ms.map((m, i) => {
                const isMy = m.home === myTeam || m.away === myTeam
                return (
                  <div key={i} className={`match-row${isMy ? ' row-my-match' : ''}`} style={{ padding: '4px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{ flex: 1, textAlign: 'right', padding: '5px 8px', fontSize: 12, fontWeight: m.home === myTeam ? 600 : 400 }}>{m.home}</div>
                      <div className="match-score">{m.score}</div>
                      <div style={{ flex: 1, textAlign: 'left', padding: '5px 8px', fontSize: 12, fontWeight: m.away === myTeam ? 600 : 400 }}>{m.away}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      })()}

      {/* Remaining rounds with outcome picker */}
      {rounds.map(round => {
        const dateStr = fmtMatchDate(round.date)
        const timeStr = round.time || ''
        return (
          <div key={round.roundNum}>
            <div className="round-header round-header-remaining">
              <span>Ronde {round.roundNum}{dateStr ? ` · ${dateStr}` : ''}{timeStr ? ` · ${timeStr}` : ''}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                <div className="whatif-preset-sm" onClick={() => onPredict(round)} title="Voorspel deze ronde" style={{ background: 'var(--btn-predict-bg)', color: 'var(--btn-predict-text)', fontStyle: 'italic' }}>✦</div>
                <div className="whatif-preset-sm" onClick={() => onSetRound(round, null)} title="Reset ronde" style={{ background: 'var(--btn-reset-bg)', color: 'var(--btn-reset-text)' }}>?</div>
              </div>
            </div>
            {round.matches.map(m => {
              const raw = locks[m.lockKey] || null
              const lock = raw ? (typeof raw === 'string' ? { result: raw } : raw) : null
              const result = lock ? lock.result : null
              const hasScore = lock && lock.scoreH != null && lock.scoreA != null
              const isMy = m.h === myTeam || m.a === myTeam
              const ko = m.isKO
              return (
                <div key={m.lockKey} className={`match-row${isMy && !lock ? ' row-my-match' : ''}`} style={{ padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      flex: 1, textAlign: 'right', padding: '5px 8px', fontSize: 12,
                      fontWeight: m.h === myTeam ? 600 : 400,
                      background: result === 'W' ? 'var(--lock-win-bg)' : 'transparent',
                      borderRadius: '4px 0 0 4px', cursor: 'pointer',
                    }} onClick={() => onToggle(m.lockKey, result === 'W' ? null : 'W')}>
                      {m.h}
                    </div>
                    {hasScore ? (
                      <div className="match-score" style={{ cursor: 'pointer', minWidth: 36 }}
                        onClick={() => { if (ko) onToggle(m.lockKey, null); else onToggle(m.lockKey, result === 'D' ? null : 'D') }}
                        title={ko ? 'Reset' : (result === 'D' ? 'Reset' : 'Gelijk')}>
                        {lock.scoreH}-{lock.scoreA}
                      </div>
                    ) : ko ? (
                      <div style={{
                        padding: '5px 10px', fontSize: 10, color: 'var(--text-vs)',
                        cursor: lock ? 'pointer' : 'default', fontWeight: 700, textAlign: 'center', minWidth: 36,
                      }} onClick={() => { if (lock) onToggle(m.lockKey, null) }} title={lock ? 'Reset' : ''}>
                        vs
                      </div>
                    ) : (
                      <div style={{
                        padding: '5px 10px', fontSize: 10, color: result === 'D' ? 'var(--lock-draw-text)' : '#ccc',
                        background: result === 'D' ? 'var(--lock-draw-bg)' : 'transparent',
                        cursor: 'pointer', fontWeight: 700, textAlign: 'center', minWidth: 36,
                      }} onClick={() => onToggle(m.lockKey, result === 'D' ? null : 'D')}>
                        {result === 'D' ? 'G' : 'vs'}
                      </div>
                    )}
                    <div style={{
                      flex: 1, textAlign: 'left', padding: '5px 8px', fontSize: 12,
                      fontWeight: m.a === myTeam ? 600 : 400,
                      background: result === 'L' ? 'var(--lock-win-bg)' : 'transparent',
                      borderRadius: '0 4px 4px 0', cursor: 'pointer',
                    }} onClick={() => onToggle(m.lockKey, result === 'L' ? null : 'L')}>
                      {m.a}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
