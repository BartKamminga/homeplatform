// VBT React-schil: start de engine (canvas/gameloop blijft plain JS) en beheert de zijpanelen:
// links MENU (M), rechts LIVE (L). Open panelen maken het speelveld smaller via --panel-left/--panel-right;
// de rit loopt gewoon door. Esc sluit eerst een open paneel, pas daarna komt de stopvraag.
import { useCallback, useEffect, useRef, useState } from 'react'
import LeftPanel from './panels/LeftPanel.jsx'
import RightPanel from './panels/RightPanel.jsx'

const LEFT_W = 340, RIGHT_W = 380
let booted = false

export default function VbtApp() {
  const [left, setLeft] = useState({ open: false, section: 'now', focus: null })
  const [right, setRight] = useState({ open: false, tab: 'telemetry' })
  const state = useRef({ left, right })
  state.current = { left, right }

  const open = useCallback((side, section, focus) => {
    if (side === 'left') setLeft(l => ({ open: true, section: section || l.section, focus: focus || null }))
    else setRight(r => ({ open: true, tab: section || r.tab }))
  }, [])
  const toggle = useCallback(side => {
    if (side === 'left') setLeft(l => ({ ...l, open: !l.open, focus: null }))
    else setRight(r => ({ ...r, open: !r.open }))
  }, [])

  // engine-start + VBT.ui zodat de engine (titelknoppen, testhaakjes) panelen kan openen
  useEffect(() => {
    window.VBT.ui = { open, toggle, close: side => (side === 'left' ? setLeft(l => ({ ...l, open: false })) : setRight(r => ({ ...r, open: false }))) }
    if (booted) return   // StrictMode draait effects in dev twee keer
    booted = true
    document.getElementById('vbt-app').hidden = false
    window.VBT.boot().then(() => window.VBT.stravaUi.init())
  }, [open, toggle])

  // speelveld smaller maken (canvas/HUD/overlays lezen deze variabelen)
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--panel-left', (left.open ? LEFT_W : 0) + 'px')
    root.setProperty('--panel-right', (right.open ? RIGHT_W : 0) + 'px')
  }, [left.open, right.open])

  // toetsen (capture: vóór de engine): M/L/K/H, Esc sluit eerst een paneel
  useEffect(() => {
    const onKey = e => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const { left: l, right: r } = state.current
      if (e.code === 'Escape' && (l.open || r.open)) {
        if (r.open) setRight(x => ({ ...x, open: false })); else setLeft(x => ({ ...x, open: false }))
        e.preventDefault()
        e.stopImmediatePropagation()
        return
      }
      if (['confirm', 'boot'].includes(document.body.dataset.state)) return
      if (e.code === 'KeyM') toggle('left')
      else if (e.code === 'KeyL') toggle('right')
      else if (e.code === 'KeyK') open('left', 'devices')
      else if (e.code === 'KeyH') open('left', 'help')
    }
    // na een klik op een knop in een paneel de focus loslaten, zodat spatie/pijltjes weer naar de game gaan
    const onClick = e => {
      const t = e.target
      if (t.closest && t.closest('.vbt-panel') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) setTimeout(() => document.activeElement?.blur(), 0)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('click', onClick, true)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('click', onClick, true) }
  }, [open, toggle])

  return (
    <>
      {left.open
        ? <LeftPanel section={left.section} focus={left.focus}
            onSection={(section, focus) => setLeft({ open: true, section, focus: focus || null })}
            onClose={() => setLeft(l => ({ ...l, open: false }))}
            onShowLog={() => open('right', 'bluetooth')} />
        : <button className="vbt-edge vbt-edge-left" onMouseDown={e => e.preventDefault()} onClick={() => toggle('left')} title="Menu (M)">&#9776; MENU</button>}
      {right.open
        ? <RightPanel tab={right.tab} onTab={tab => setRight({ open: true, tab })} onClose={() => setRight(r => ({ ...r, open: false }))} />
        : <button className="vbt-edge vbt-edge-right" onMouseDown={e => e.preventDefault()} onClick={() => toggle('right')} title="Live (L)">LIVE &#9636;</button>}
    </>
  )
}
