// VBT React-schil: start de engine (canvas/gameloop blijft plain JS) en beheert de zijpanelen:
// links MENU (M), rechts LIVE (L). Open panelen maken het speelveld smaller via --panel-left/--panel-right;
// de rit loopt gewoon door. Esc sluit eerst een open paneel, pas daarna komt de stopvraag.
// Buiten een rit is het menu breed (plan, workouts, ritten); start je een rit, dan gaat het menu dicht.
import { useCallback, useEffect, useRef, useState } from 'react'
import LeftPanel from './panels/LeftPanel.jsx'
import RightPanel from './panels/RightPanel.jsx'
import { useVbtValue } from './hooks/useVbt.js'
import { ConfirmHost } from './common/ConfirmDialog.jsx'
import ToastHost from './common/Toast.jsx'
import FinishScreen from './screens/FinishScreen.jsx'
import Hud from './hud/Hud.jsx'
import { TitleScreen, Countdown, Paused, ConfirmStop, Crt } from './screens/Overlays.jsx'
import useBodyState from './hooks/useBodyState.js'
import * as strava from './features/strava/strava.js'

const LEFT_W = 340, RIGHT_W = 380
const RIDING = ['ride', 'paused', 'countdown', 'confirm']
const wideWidth = () => Math.min(900, Math.round(window.innerWidth * 0.6))
// tijdens een rit staat NOW vooraan, daarbuiten TODAY
const fitSection = (section, riding) => (riding ? section : section === 'now' ? 'today' : section)
let booted = false

// los component: body-status volgt het snelle snapshot zonder de hele app 10x/s te renderen
function BodyState() { useBodyState(); return null }

export default function VbtApp() {
  const [left, setLeft] = useState({ open: false, section: 'today', focus: null })
  const [right, setRight] = useState({ open: false, tab: 'telemetry' })
  const riding = useVbtValue(s => RIDING.includes(s.state))
  const [wide, setWide] = useState(wideWidth)
  const leftW = riding ? LEFT_W : wide
  const state = useRef({ left, right })
  state.current = { left, right }
  const isRiding = () => RIDING.includes(window.VBT.store.getSnapshot().state)

  const open = useCallback((side, section, focus) => {
    if (side === 'left') setLeft(l => ({ open: true, section: section || fitSection(l.section, isRiding()), focus: focus || null }))
    else setRight(r => ({ open: true, tab: section || r.tab }))
  }, [])
  const toggle = useCallback(side => {
    if (side === 'left') setLeft(l => ({ ...l, open: !l.open, section: l.open ? l.section : fitSection(l.section, isRiding()), focus: null }))
    else setRight(r => ({ ...r, open: !r.open }))
  }, [])

  // engine-start + VBT.ui zodat de engine (titelknoppen, testhaakjes) panelen kan openen
  useEffect(() => {
    window.VBT.ui = { open, toggle, close: side => (side === 'left' ? setLeft(l => ({ ...l, open: false })) : setRight(r => ({ ...r, open: false }))) }
    if (booted) return   // StrictMode draait effects in dev twee keer
    booted = true
    document.getElementById('vbt-app').hidden = false
    window.VBT.boot().then(() => strava.init())
  }, [open, toggle])

  // rit gestart: menu dicht (de weg weer breed); rit klaar: NOW is er niet meer
  const wasRiding = useRef(riding)
  useEffect(() => {
    if (riding && !wasRiding.current) setLeft(l => ({ ...l, open: false, section: 'now' }))
    if (!riding && wasRiding.current) setLeft(l => ({ ...l, section: fitSection(l.section, false) }))
    wasRiding.current = riding
  }, [riding])

  useEffect(() => {
    const onResize = () => setWide(wideWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // speelveld smaller maken (canvas/HUD/overlays lezen deze variabelen)
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--panel-left', (left.open ? leftW : 0) + 'px')
    root.setProperty('--panel-right', (right.open ? RIGHT_W : 0) + 'px')
    document.body.classList.toggle('menu-wide', left.open && !riding)   // titelknoppen weg: het menu staat al open
  }, [left.open, right.open, leftW, riding])

  // toetsen (capture: vóór de engine): M/L/K/H, Esc sluit eerst een paneel
  useEffect(() => {
    const onKey = e => {
      if (document.querySelector('.vbt-dialog')) return     // het bevestigingsvenster heeft de toetsen
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
      <ConfirmHost />
      <ToastHost />
      <BodyState />
      <Hud />
      <TitleScreen />
      <Countdown />
      <Paused />
      <ConfirmStop />
      <FinishScreen />
      <Crt />
      {left.open
        ? <LeftPanel section={left.section} focus={left.focus} riding={riding} width={leftW}
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
