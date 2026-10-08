import { useState, useEffect } from 'react'
import PublicSite from '../../screens/PublicSite.jsx'
import SectionContent from './SectionContent.jsx'
import { SECTIONS, panelForView, viewForSection } from './studioSync.js'
import { onDataChanged } from '../../dataChanged.js'

// Beheerstudio voor een groot scherm (item 1239): links de site zoals
// bezoekers hem zien, rechts het bewerkscherm van de pagina die links open
// staat. Navigeren kan aan beide kanten; de andere kant loopt mee. Na elke
// opslag ververst de preview vanzelf.
export default function AdminStudio({ me }) {
  const [view, setView] = useState({ name: 'home' })
  const [panel, setPanel] = useState({ section: 'home' })
  const [previewKey, setPreviewKey] = useState(0)
  const [wide, setWide] = useState(false)

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
    <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : 'minmax(380px, 440px) 1fr', height: '100vh', background: '#eef0f4' }}>
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #dde1ea' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, background: 'white', borderBottom: '1px solid #dde1ea' }}>
          <strong style={{ flex: 1 }}>Bekijk site</strong>
          <button className="yof-btn-secondary" onClick={() => setWide(w => !w)}>{wide ? 'Telefoon' : 'Breed'}</button>
          <button className="yof-btn-secondary" onClick={() => setPreviewKey(k => k + 1)} title="Preview verversen">&#8635;</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <PublicSite key={previewKey} previewMode adminMode studio
            view={view} onViewChange={changeView}
            onEditMatch={openMatch}
            onEditPlayer={id => changeView({ name: 'player', id })}
            onEditGeneral={reportId => setPanel({ section: 'verslagen', reportId: reportId || undefined })}
          />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'white' }}>
        <div style={{ padding: '10px 24px 0', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Beheer</h2>
            {me && <span style={{ fontSize: 12, color: '#888' }}>ingelogd als {me.username}</span>}
          </div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 6 }}>
            {SECTIONS.map(t => (
              <button key={t.key} onClick={() => selectSection(t.key)} style={{
                padding: '8px 12px', fontSize: 13, fontWeight: panel.section === t.key ? 600 : 400,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: panel.section === t.key ? '2px solid #f4c81e' : '2px solid transparent',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 40px' }}>
          <div style={{ maxWidth: 760 }}>
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
