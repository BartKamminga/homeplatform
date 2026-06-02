import React from 'react'
import SimPouleCard from './SimPouleCard'

export default function RemainingPouleCards({ data, pouleIds, myTeam, locks, showForm, showPlayed, showMatches, onToggle, onSetRound, onPredict, onPredictAllRounds, onResetAll, onPredictSection, onResetSection }) {
  const gridCls = pouleIds.length <= 2 ? 'grid-2' : pouleIds.length <= 4 ? 'grid-4' : 'grid-5'

  return (
    <div>
      <div className={gridCls}>
        {pouleIds.map(pouleId => {
          const poule = data[pouleId]
          if (!poule || poule.remaining.length === 0) return null
          const mpr = Math.floor(poule.teams.length / 2)
          const ma = poule.matches_played || []
          const lr = ma.length > 0 ? Math.max(...ma.map(m => parseInt(m.round) || 0)) : 0
          const rounds = []
          if (mpr > 0) {
            for (let i = 0; i < poule.remaining.length; i += mpr) {
              const ms = poule.remaining.slice(i, i + mpr)
              const roundNum = lr + Math.floor(i / mpr) + 1
              rounds.push({
                pouleId, roundNum,
                date: ms[0] && ms[0][2],
                matches: ms.map(([h, a, date]) => ({ h, a, date, lockKey: `${h}_${a}` }))
              })
            }
          }
          return <SimPouleCard key={pouleId} title={`Poule ${pouleId}`} teams={poule.teams} basePts={poule.pts} baseDs={poule.ds}
            rounds={rounds} locks={locks} myTeam={myTeam} onToggle={onToggle} onSetRound={onSetRound} onPredict={onPredict}
            onPredictAll={() => onPredictAllRounds(rounds, poule)} matchesPlayed={poule.matches_played} showForm={showForm} showPlayed={showPlayed} showMatches={showMatches} />
        })}
      </div>
    </div>
  )
}
