// Onderdelen van MY PLAN (items 1343/1306): beschikbaarheid in minuten per weekdag, en een plan-workout
// verplaatsen naar een andere dag van die week (ruilen) of overslaan.
import { useEffect, useState } from 'react'
import { dayLabel, WEEKDAYS } from '../../common/format.js'

export function AvailabilityEditor() {
  const P = window.VBT.planAdapt, S = window.VBT.settings
  const [av, setAv] = useState(() => Object.assign({}, S.values.availability || {}))
  const [open, setOpen] = useState(false)
  useEffect(() => { setAv(Object.assign({}, S.values.availability || {})) }, [open])
  const set = (d, v) => setAv(a => Object.assign({}, a, { [d]: v === '' ? '' : Math.max(0, Math.min(300, parseInt(v, 10) || 0)) }))
  const save = () => {
    const clean = Object.fromEntries(Object.entries(av).filter(([, v]) => v !== '' && v !== null))
    P.setAvailability(clean)
    setOpen(false)
  }
  const cur = S.values.availability || {}
  const summary = Object.keys(cur).length ? WEEKDAYS.map((d, i) => cur[i + 1] === undefined ? null : d + ' ' + (cur[i + 1] ? cur[i + 1] + "'" : 'OFF')).filter(Boolean).join(' · ') : 'not set - workouts keep their length'
  return (
    <div className="pn-avail">
      <small>MY TIME PER DAY · {summary}</small>
      {!open && <button id="availEdit" className="ghostbtn" onClick={() => setOpen(true)}>SET MY TIME</button>}
      {open && (
        <>
          <div className="pn-availgrid">
            {WEEKDAYS.map((d, i) => (
              <label key={d}>{d}<input id={'avail' + (i + 1)} type="number" min="0" max="300" placeholder="-" value={av[i + 1] ?? ''}
                onChange={e => set(i + 1, e.target.value)} /></label>
            ))}
          </div>
          <p className="pn-hint">Minutes you can ride (0 = no time). Longer workouts get the matching shorter version on that day; leave empty for no limit.</p>
          <div className="pn-buttons">
            <button className="ghostbtn" onClick={() => setOpen(false)}>CANCEL</button>
            <button id="availSave" className="ridebtn" onClick={save}>SAVE</button>
          </div>
        </>
      )}
    </div>
  )
}

// MOVE TO: een andere dag in dezelfde week; SKIP / UNSKIP
export function MoveBar({ wo }) {
  const VBT = window.VBT, P = VBT.planAdapt, C = VBT.calendar
  if (!wo || !wo.week || C.getState().done[wo.id]) return null
  const cur = C.iso(C.dateFor(wo))
  const skipped = P.isSkipped(wo.id)
  return (
    <div className="pn-movebar">
      <small>MOVE TO</small>
      <span className="pn-viewtoggle">
        {P.weekDays(wo).map(d => {
          const iso = C.iso(d)
          return <button key={iso} className={iso === cur ? 'active' : ''} onClick={() => P.moveTo(wo.id, iso)} title={dayLabel(d)}>{dayLabel(d).slice(0, 3)}</button>
        })}
      </span>
      <button className="ghostbtn" onClick={() => (skipped ? P.unskip(wo.id) : P.skip(wo.id))}>{skipped ? 'UNSKIP' : 'SKIP'}</button>
    </div>
  )
}

