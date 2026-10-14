import { useState, useEffect, useRef } from 'react'
import { useDialogs } from './hooks/useDialogs.jsx'
import { useLibrary } from './hooks/useLibrary.js'
import { useTreeDrag } from './hooks/useTreeDrag.js'
import { SectionBlock, RackBlock, AddRow, cradeList } from './TreeBlocks.jsx'
import NewCradeForm from './NewCradeForm.jsx'
import SettingsDrawer from './settings/SettingsDrawer.jsx'

// Arcade-variant van BeatCrades (item 1338): boom Section → Rack → Crade.
export default function ArcadeApp() {
  const dialogs = useDialogs()
  const lib = useLibrary(dialogs)
  const dnd = useTreeDrag(lib)
  const [formOpen, setFormOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef(null)
  const { tree } = lib

  useEffect(() => {
    if (!menuOpen) return
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const pick = fn => () => { setMenuOpen(false); fn() }
  const isEmpty = lib.loaded && !tree.sections.length && !tree.racks.length && !tree.crades.length

  return (
    <div className="bca-app">
      <header className="bca-head">
        <div>
          <div className="ac-logo">BEATCRADES</div>
          <div className="bca-sub">BEATPORT · YOUTUBE · SOUNDCLOUD</div>
        </div>
        <div className="bca-head-acts">
          <button type="button" className="ac-btn ac-btn--sm" onClick={() => lib.open.all(false)}>COLLAPSE</button>
          <button type="button" className="ac-btn ac-btn--sm" onClick={() => lib.open.all(true)}>EXPAND</button>
          <button type="button" className="ac-btn ac-btn--sm ac-btn--cyan" onClick={() => setSettingsOpen(true)}>SETTINGS</button>
          <div className="bca-menu-wrap" ref={menuRef}>
            <button type="button" className="ac-btn ac-btn--sm ac-btn--primary" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}>
              + NEW {menuOpen ? '▴' : '▾'}
            </button>
            {menuOpen && (
              <div className="bca-menu" role="menu">
                <button type="button" role="menuitem" onClick={pick(() => setFormOpen(true))}><b>◉ CRADE</b><small>URL → download</small></button>
                <button type="button" role="menuitem" onClick={pick(() => lib.actions.addRack(null))}><b>▤ RACK</b><small>Group crades</small></button>
                <button type="button" role="menuitem" onClick={pick(lib.actions.promptSection)}><b>▣ SECTION</b><small>Group racks</small></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="bca-main">
        {formOpen && <NewCradeForm tree={tree} racks={lib.allRacks} onCreate={lib.actions.createCrade} onClose={() => setFormOpen(false)} />}

        {isEmpty && !formOpen ? (
          <div className="ac-state bca-empty">
            <div className="ac-big-msg">NO CRADES<br />YET</div>
            <p className="ac-hint" style={{ maxWidth: '44ch' }}>A crade is one download: a chart, release or playlist. Put crades in racks, and racks in sections.</p>
            <button type="button" className="ac-btn ac-btn--primary ac-btn--lg" onClick={() => setFormOpen(true)}>+ NEW CRADE</button>
            <div className="bca-press ac-blink">PRESS + TO START</div>
          </div>
        ) : (
          <>
            {tree.sections.map(s => <SectionBlock key={s.id} section={s} lib={lib} dnd={dnd} />)}
            {tree.racks.map(r => <RackBlock key={r.id} rack={r} lib={lib} dnd={dnd} />)}
            {tree.crades.length > 0 && <div className="bca-loose">{cradeList(tree.crades, lib, dnd)}</div>}
          </>
        )}

        {dnd.drag?.kind === 'crade' && (
          <div className={`bca-drop${dnd.isOver('root-crade', null) ? ' over' : ''}`} {...dnd.rootCradeZone}>↩ DROP HERE TO TAKE THE CRADE OUT OF ITS RACK</div>
        )}
        {dnd.drag?.kind === 'rack' && (
          <div className={`bca-drop${dnd.isOver('root-rack', null) ? ' over' : ''}`} {...dnd.rootRackZone}>↩ DROP HERE TO TAKE THE RACK OUT OF ITS SECTION</div>
        )}

        {!isEmpty && <AddRow placeholder="Name of a new section…" button="+ SECTION" onSubmit={lib.actions.addSection} />}
      </main>

      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} onDone={lib.load} />}
      {dialogs.node}
    </div>
  )
}
