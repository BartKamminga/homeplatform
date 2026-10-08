import { useState, useEffect } from 'react'
import PublicSite from '../../screens/PublicSite.jsx'
import SectionContent from './SectionContent.jsx'
import { panelForView, viewForSection } from './studioSync.js'
import SectionTabs from './SectionTabs.jsx'
import { onDataChanged } from '../../dataChanged.js'
import useResizableWidth from './useResizableWidth.js'

const PRESETS = [
  { label: 'Telefoon', width: 390 },
  { label: 'Tablet', width: 768 },
]

// Beheerstudio voor een groot scherm (item 1239): links de site zoals
// bezoekers hem zien, rechts het bewerkscherm van de pagina die links open
// staat. Navigeren kan aan beide kanten; de andere kant loopt mee. Na elke
// opslag ververst de preview vanzelf.
export default function AdminStudio({ me }) {
  const [view, setView] = useState({ name: 'home' })
  const [panel, setPanel] = useState({ section: 'home' })
  const [previewKey, setPreviewKey] = useState(0)
  const preview = useResizableWidth()
  const maxed = preview.width >= preview.maxWidth()

  useEffect(() => {
    let timer
    const off = onDataChanged(() => {
      clearTimeout(timer)
      timer = setTimeout(() => setPreviewKey(k => k + 1), 400)
    })
    return () => { off(); clearTimeout(timer) }
  }, [])

  function changeView(next) {
    setView(next)
    const p = panelForView(next)
    if (p) setPanel(p)
  }

  function selectSection(section) {
    setPanel({ section })
    const v = viewForSection(section)
    if (v) setView(v)
  }

  function openMatch(matchRef) {
    setPanel({ section: 'wedstrijden', matchRef })
    setView({ name: 'entry', ref: matchRef })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${preview.width + preview.gutter}px 8px 1fr`, height: '100vh', background: '#eef0f4' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 12px', fontSize: 13, background: 'white', borderBottom: '1px solid #dde1ea' }}>
          <strong style={{ flex: 1 }}>Bekijk site</strong>
          {PRESETS.map(p => (
            <button key={p.label} className="yof-btn-secondary" onClick={() => preview.setWidth(p.width)}
              style={preview.width === p.width ? { background: '#12203c', color: 'white', borderColor: '#12203c' } : undefined}>
              {p.label}
            </button>
          ))}
          <button className="yof-btn-secondary" onClick={() => preview.setWidth(preview.maxWidth())}
            style={maxed ? { background: '#12203c', color: 'white', borderColor: '#12203c' } : undefined}>Breed</button>
          <span style={{ fontSize: 11, color: '#999', minWidth: 46, textAlign: 'right' }}>{preview.width} px</span>
          <button className="yof-btn-secondary" onClick={() => setPreviewKey(k => k + 1)} title="Preview verversen">&#8635;</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${preview.gutter / 2}px` }}>
          <div style={{ width: preview.width, margin: '0 auto', boxShadow: '0 2px 12px rgba(18,32,60,.12)', borderRadius: 12, overflow: 'hidden' }}>
            <PublicSite key={previewKey} previewMode adminMode studio
              view={view} onViewChange={changeView}
              onEditMatch={openMatch}
              onEditPlayer={id => changeView({ name: 'player', id })}
            />
          </div>
        </div>
      </section>

      <div onMouseDown={preview.startDrag} title="Sleep om de preview breder of smaller te maken"
        style={{ cursor: 'col-resize', background: '#dde1ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 2, height: 40, borderRadius: 2, background: '#9aa5c0' }} />
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'white' }}>
        <div style={{ padding: '10px 24px 0', borderBottom: '1px solid #eee' }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Beheer</h2>
              {me && <span style={{ fontSize: 12, color: '#888' }}>ingelogd als {me.username}</span>}
            </div>
            <SectionTabs active={panel.section} onSelect={selectSection} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 40px' }}>
          {/* class yof: zelfde kleuren/lettertype als de site, zodat pagina's die rechts
              in bewerkmodus staan (Home, Competitie) er net zo uitzien als links */}
          <div className="yof" style={{ maxWidth: 820, margin: '0 auto', minHeight: 0, background: 'transparent' }}>
            <SectionContent panel={panel}
              onOpenMatch={openMatch}
              onCloseMatch={() => selectSection('wedstrijden')}
              onSelectSection={selectSection}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
