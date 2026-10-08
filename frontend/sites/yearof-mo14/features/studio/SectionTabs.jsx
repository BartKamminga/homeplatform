import { useState } from 'react'
import { createCustomPage, setBlockLive } from '../../api.js'
import useCustomPages, { MAX_CUSTOM_PAGES } from '../pages/useCustomPages.js'
import { buildSections } from './studioSync.js'
import usePageMeta, { SECTION_VIEW } from '../pages/pageMeta.js'

// Tabbalk van het beheer: de pagina's van de site in menuvolgorde, dan de eigen
// pagina's (+ Pagina zolang er minder dan 3 zijn), dan wat geen eigen pagina
// heeft (item 1239). extraTabs: bv. "Bekijk site" op een klein scherm.
export default function SectionTabs({ active, onSelect, extraTabs = [] }) {
  const customPages = useCustomPages()
  const meta = usePageMeta()
  // Namen van de vaste pagina's zoals ingesteld (item 1248)
  const sections = [...buildSections(customPages), ...extraTabs]
    .map(s => (SECTION_VIEW[s.key] ? { ...s, label: meta(SECTION_VIEW[s.key]).label } : s))
  const [busy, setBusy] = useState(false)
  const firstExtra = sections.findIndex(s => s.extra)

  async function addPage() {
    setBusy(true)
    try {
      const page = await createCustomPage({ label: 'Nieuwe pagina', title: 'Nieuwe pagina' })
      await setBlockLive(`page.${page.id}`, false) // nieuw = concept, pas live na inrichten
      onSelect(`custom:${page.id}`)
    } finally { setBusy(false) }
  }

  const tab = (t, i) => (
    <button key={t.key} onClick={() => onSelect(t.key)} style={{
      padding: '8px 12px', fontSize: 13, fontWeight: active === t.key ? 600 : 400,
      background: 'transparent', border: 'none', cursor: 'pointer', color: t.extra ? '#888' : undefined,
      marginLeft: i === firstExtra ? 18 : 0, // scheiding tussen de pagina's van de site en de rest
      borderBottom: active === t.key ? '2px solid #f4c81e' : '2px solid transparent',
    }}>
      {t.label}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
      {sections.slice(0, firstExtra).map(tab)}
      {customPages.length < MAX_CUSTOM_PAGES && (
        <button onClick={addPage} disabled={busy} title={`Eigen pagina toevoegen (max ${MAX_CUSTOM_PAGES})`}
          style={{ padding: '6px 10px', fontSize: 12, border: '1px dashed #bbb', borderRadius: 999, background: 'transparent', cursor: 'pointer', color: '#666' }}>
          + Pagina
        </button>
      )}
      {sections.slice(firstExtra).map((t, i) => tab(t, i + firstExtra))}
    </div>
  )
}
