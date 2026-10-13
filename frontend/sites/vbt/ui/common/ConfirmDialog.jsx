// Eigen bevestigingsvenster in VBT-stijl (i.p.v. window.confirm van de browser).
// Gebruik: if (await confirmDialog({ title, text, yes, no, danger })) { ... }  - Enter/Y = ja, Esc/N = nee.
// Ook bruikbaar vanuit de engine via VBT.confirm(...). <ConfirmHost /> staat één keer in VbtApp.
import { useEffect, useState } from 'react'

let show = null
const queue = []

export function confirmDialog(opts) {
  return new Promise(resolve => {
    queue.push({ ...opts, resolve })
    if (show) show(queue[0])
  })
}

export function ConfirmHost() {
  const [cur, setCur] = useState(null)

  useEffect(() => {
    show = item => setCur(c => c || item)
    window.VBT.confirm = confirmDialog
    if (queue.length) setCur(queue[0])
    return () => { show = null }
  }, [])

  const answer = ok => {
    const item = queue.shift()
    item?.resolve(ok)
    setCur(queue[0] || null)
  }

  // toetsen vóór de game en de panelen (capture), en niet doorgeven
  useEffect(() => {
    if (!cur) return
    const onKey = e => {
      const yes = e.code === 'Enter' || e.code === 'KeyY', no = e.code === 'Escape' || e.code === 'KeyN'
      e.preventDefault()
      e.stopImmediatePropagation()
      if (yes) answer(true)
      else if (no) answer(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cur])

  if (!cur) return null
  return (
    <div className="vbt-dialog" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) answer(false) }}>
      <div className="confirmbox">
        <h2>{cur.title || 'ARE YOU SURE?'}</h2>
        {cur.text && <p>{cur.text}</p>}
        <div className="confirmbtns">
          <button id="dlgNo" className="ghostbtn" onClick={() => answer(false)}>{cur.no || 'NO'} <em>N / ESC</em></button>
          <button id="dlgYes" className={'ridebtn' + (cur.danger ? ' danger' : '')} autoFocus onClick={() => answer(true)}>{cur.yes || 'YES'} <em>Y / ENTER</em></button>
        </div>
      </div>
    </div>
  )
}
