import { useState, useRef } from 'react'
import MatchRow, { fmtRoundDate } from './MatchRow.jsx'

// Uitslagen en programma als rolodex (item 1229): altijd 2 rondes in beeld,
// bladeren schuift het venster 1 ronde op (pijltjes, pijltjestoetsen of
// vegen). Start op [afgelopen ronde, volgende ronde]. Stipjes = alle rondes
// (gevuld = gespeeld, donker = in beeld); klik op een stip = daarheen.
// rounds = [{ round, matches }] op volgorde; labels = { [round]: 'Afgelopen ronde' | ... }

// windowSize (item 1244, instelling van het blok): 2 of 3 rondes in beeld,
// of 'all' = alle rondes onder elkaar, zonder bladeren (gewoon scrollen).
export default function RoundRolodex({ rounds, startIndex, isPlayed, labels, teamName, windowSize = 2 }) {
  const all = windowSize === 'all'
  const WINDOW = all ? rounds.length : windowSize
  const maxStart = Math.max(0, rounds.length - WINDOW)
  const [start, setStart] = useState(Math.min(Math.max(0, startIndex), maxStart))
  const [direction, setDirection] = useState('')
  const touchX = useRef(null)

  function goTo(target) {
    const clamped = Math.min(Math.max(0, target), maxStart)
    if (clamped === start) return
    setDirection(clamped > start ? 'next' : 'prev')
    setStart(clamped)
  }

  const shown = rounds.slice(start, start + WINDOW)
  const first = shown[0]
  const lastShown = shown[shown.length - 1]
  const arrow = disabled => ({
    width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd', background: 'white', flexShrink: 0,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1, fontSize: 18, lineHeight: '30px', padding: 0,
  })

  return (
    <div tabIndex={0} style={{ outline: 'none' }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { goTo(start + 1); e.preventDefault() }
        if (e.key === 'ArrowLeft') { goTo(start - 1); e.preventDefault() }
      }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) goTo(start + (dx < 0 ? 1 : -1))
        touchX.current = null
      }}>
      {!all && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 6px' }}>
          <button onClick={() => goTo(start - 1)} disabled={start === 0} style={arrow(start === 0)} aria-label="Eerdere ronde">&lsaquo;</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
            {rounds.map((r, i) => {
              const inView = i >= start && i < start + WINDOW
              return (
                <button key={r.round} onClick={() => goTo(Math.min(i, maxStart))} aria-label={`Ronde ${r.round}`} title={`Ronde ${r.round}`} style={{
                  width: inView ? 16 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer',
                  background: inView ? '#12203c' : isPlayed(r) ? '#9aa5c0' : '#dfe3ec', transition: 'width .2s',
                }} />
              )
            })}
          </div>
          <button onClick={() => goTo(start + 1)} disabled={start >= maxStart} style={arrow(start >= maxStart)} aria-label="Latere ronde">&rsaquo;</button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#999', marginBottom: 4 }}>
          Ronde {first.round}{lastShown !== first ? `–${lastShown.round}` : ''} van {rounds.length}
        </div>
      </>}

      <div key={start} className={direction ? `yof-rolodex-${direction}` : ''}>
        {shown.map(r => (
          <div key={r.round} style={{ borderTop: '1px solid #eee', paddingBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 2px', fontSize: 13 }}>
              <strong>
                {labels[r.round] || `Ronde ${r.round}`}
                {labels[r.round] && <span style={{ fontWeight: 400, color: '#888' }}> · ronde {r.round}</span>}
              </strong>
              <span style={{ color: '#888', fontSize: 12 }}>{fmtRoundDate(r.matches[0].date)}</span>
            </div>
            {r.matches.map(m => <MatchRow key={m.match_id} m={m} teamName={teamName} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
