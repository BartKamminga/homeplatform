// WORKOUTS: de bibliotheek - eigen .zwo-imports, CLIMB TRAINING en de workouts per plan; zoeken, filter op
// duur, importeren via knop of bestanden op het paneel slepen, eigen imports verwijderen.
import { useCallback, useEffect, useMemo, useState } from 'react'
import CanvasChart from '../../common/CanvasChart.jsx'
import { actions } from '../../hooks/useVbt.js'
import { minutes } from '../../common/format.js'
import { WorkoutDetail, ClimbDetail } from './WorkoutDetail.jsx'
import { confirmDialog } from '../../common/ConfirmDialog.jsx'

const DURATIONS = [['all', 'ANY LENGTH'], ['30', '< 45 MIN'], ['60', '45-75 MIN'], ['90', '> 75 MIN']]
const fitsDuration = (sec, f) => f === 'all' || (f === '30' ? sec < 2700 : f === '60' ? sec >= 2700 && sec <= 4500 : sec > 4500)

export default function WorkoutsSection() {
  const VBT = window.VBT
  const [workouts, setWorkouts] = useState([])
  const [climbs, setClimbs] = useState([])
  const [q, setQ] = useState('')
  const [dur, setDur] = useState('all')
  const [sel, setSel] = useState(null)
  const [msg, setMsg] = useState([])

  const load = useCallback(async () => {
    try { setWorkouts(await actions().listWorkouts()) } catch { setWorkouts([]) }
    try { setClimbs(VBT.climbs ? await VBT.climbs.load() : []) } catch { setClimbs([]) }
  }, [])
  useEffect(() => { load() }, [load])

  const planNames = Object.fromEntries((VBT.calendar.getState().plans || []).map(p => [p.slug, p.name]))
  const match = name => !q || name.toLowerCase().includes(q.toLowerCase())
  const groups = useMemo(() => {
    const ws = workouts.filter(w => match(w.name) && fitsDuration(w.duration, dur))
    const sources = [...new Set(ws.map(w => w.source))].sort((a, b) => (a === 'zwo' ? -1 : b === 'zwo' ? 1 : a.localeCompare(b)))
    const out = sources.map(src => ({ key: src, title: src === 'zwo' ? 'MY IMPORTS' : src === 'vbt' ? 'VBT WORKOUTS' : (planNames[src] || src).toUpperCase(), items: ws.filter(w => w.source === src) }))
    const cl = climbs.filter(c => match(c.name) && dur === 'all')
    if (cl.length) out.splice(sources[0] === 'zwo' ? 1 : 0, 0, { key: 'climbs', title: 'CLIMB TRAINING', climbs: true, items: cl })
    // FTP-tests (Ramp Test / 20-min FTP Test) uit alle plannen bovenaan, ook als ze in een plan voorkomen;
    // dezelfde test (naam + duur) maar één keer
    const seen = new Set()
    const tests = ws.filter(w => VBT.ftp.testType(w) && !seen.has(w.name + w.duration) && seen.add(w.name + w.duration))
    if (tests.length) out.unshift({ key: 'ftptests', title: 'FTP TESTS', tests: true, items: tests })
    return out
  }, [workouts, climbs, q, dur])

  const importFiles = async fileList => {
    const files = [...fileList].filter(f => /\.zwo$/i.test(f.name))
    if (!files.length) { VBT.toast?.('ONLY .ZWO FILES CAN BE IMPORTED'); return }
    try {
      const r = await actions().importZwo(files)
      setMsg(r.skipped)
      VBT.toast?.('IMPORTED ' + r.imported.length + (r.skipped.length ? ' · SKIPPED ' + r.skipped.length : ''))
      await load()
      if (r.imported[0]) setSel({ wo: r.imported[0] })
    } catch (e) { VBT.toast?.('IMPORT FAILED: ' + e.message, 6000) }
  }
  const remove = async (e, wo) => {
    e.stopPropagation()
    if (!(await confirmDialog({ title: 'DELETE WORKOUT?', text: '"' + wo.name + '" is removed from your library.', yes: 'DELETE', danger: true }))) return
    try { await actions().deleteWorkout(wo.id) } catch (err) { VBT.toast?.(err.message, 6000); return }
    if (sel?.wo?.id === wo.id) setSel(null)
    load()
  }

  return (
    <div className="pn-section" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); importFiles(e.dataTransfer.files) }}>
      <div className="pn-libcol">
        <div className="pn-filter">
          <input type="search" placeholder="Search workouts and climbs" value={q} onChange={e => setQ(e.target.value)} />
          <select value={dur} onChange={e => setDur(e.target.value)}>{DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="ghostbtn">&#8679; .ZWO<input type="file" accept=".zwo" multiple hidden onChange={e => { importFiles(e.target.files); e.target.value = '' }} /></label>
        </div>
        {msg.length > 0 && <div className="pn-hint">{msg.map(s => <div key={s.file}>&#9888; {s.file}: {s.reason}</div>)}</div>}
        <div className="pn-libscroll">
          {groups.map(g => (
            <div key={g.key}>
              <h4 className="libhead">{g.title} <em>{g.items.length}</em></h4>
              <div className="libgrid">
                {g.items.map(it => g.climbs ? (
                  <button key={it.slug} className={'wcard libcard' + (sel?.climb?.slug === it.slug ? ' selected' : '')} onClick={() => setSel({ climb: it })}>
                    <span className="wdate">{it.category ? 'CAT ' + it.category : 'CLIMB'}</span><b>{it.name.toUpperCase()}</b>
                    <span className="wmeta">{VBT.climbs.meta(it)}</span>
                    <CanvasChart height={26} className="wmini" draw={(ctx, w, h) => VBT.climbs.drawProfile(ctx, it, w, h)} />
                  </button>
                ) : (
                  <button key={g.key + it.id} className={'wcard libcard' + (sel?.wo?.id === it.id ? ' selected' : '')} onClick={() => setSel({ wo: it })}>
                    <span className="wdate">{g.tests ? (VBT.ftp.testType(it) === 'ramp' ? 'RAMP · 75% BEST 1 MIN' : '20 MIN · 95% BEST 20 MIN') : g.title}</span><b>{it.name.toUpperCase()}</b>
                    <span className="wmeta">{minutes(it.duration)} · TSS {VBT.workout.tss(it)}</span>
                    <CanvasChart height={26} className="wmini" draw={(ctx, w, h) => VBT.workout.drawChart(ctx, it, w, h)} />
                    {it.mine && <i className="wdel" title="Delete" onClick={e => remove(e, it)}>&#10005;</i>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!groups.length && <p className="pn-hint">Nothing found.</p>}
        </div>
      </div>
      {sel && <div className="pn-sticky">{sel.wo ? <WorkoutDetail wo={sel.wo} /> : <ClimbDetail climb={sel.climb} />}</div>}
      {!sel && <p className="pn-hint">Pick a workout or climb. Drop .zwo files here to import them.</p>}
    </div>
  )
}
