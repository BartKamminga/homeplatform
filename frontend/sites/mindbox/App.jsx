import { useState } from 'react'
import ItemsPage from './pages/ItemsPage.jsx'
import CasesPage from './pages/CasesPage.jsx'
import ContextsPage from './pages/ContextsPage.jsx'
import ResponsesPage from './pages/ResponsesPage.jsx'

const TABS = [
  { key: 'items', label: '📥 Bestanden' },
  { key: 'cases', label: '📁 Cases' },
  { key: 'contexts', label: '🎭 Contexts' },
  { key: 'responses', label: '📝 Responses' },
]

// Bart, 2-09-2026: "moet primair goed op een monitor werken, dus gebruik de
// hele breedte" - geen mobiel-eerste PWA-opzet zoals dontforget, geen
// gematigde maxWidth:960-kolom zoals hockey-inside. Desktop-werkomgeving.
export default function App() {
  const [tab, setTab] = useState('items')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 24, padding: '14px 32px',
        borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)',
      }}>
        <strong style={{ fontSize: 16 }}>🧠 Mindbox</strong>
        <nav style={{ display: 'flex', gap: 6 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: tab === t.key ? 'var(--color-primary)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--color-text-muted)',
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 32px' }}>
        {tab === 'items' && <ItemsPage />}
        {tab === 'cases' && <CasesPage />}
        {tab === 'contexts' && <ContextsPage />}
        {tab === 'responses' && <ResponsesPage />}
      </main>
    </div>
  )
}
