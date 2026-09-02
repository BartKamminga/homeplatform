import { useState } from 'react'
import ItemsPage from './pages/ItemsPage.jsx'
import CasesPage from './pages/CasesPage.jsx'
import ContextsPage from './pages/ContextsPage.jsx'
import ContactsPage from './pages/ContactsPage.jsx'
import KnowledgePage from './pages/KnowledgePage.jsx'
import CommandsPage from './pages/CommandsPage.jsx'

// Responses hebben BEWUST geen eigen tab (item 1051, Bart: "het is niet
// relevant om losse responses te bekijken") - responses zijn altijd
// case-gescoped en leven daarom alleen binnen CasesPage/CaseDetail.
const TABS = [
  { key: 'cases', label: '📁 Cases' },
  { key: 'items', label: '📥 Bestanden' },
  { key: 'contexts', label: '🎭 Contexts' },
  { key: 'contacts', label: '👤 Contacts' },
  { key: 'knowledge', label: '📚 Kennis' },
  { key: 'commands', label: "⚙️ Commando's" },
]

// Bart, 2-09-2026: "moet primair goed op een monitor werken, dus gebruik de
// hele breedte" - geen mobiel-eerste PWA-opzet zoals dontforget, geen
// gematigde maxWidth:960-kolom zoals hockey-inside. Desktop-werkomgeving.
export default function App() {
  const [tab, setTab] = useState('cases')
  const [focusCaseId, setFocusCaseId] = useState(null)

  // Item 1051 (Bart): bij een duplicaat-upload moet "annuleren" je naar het
  // BESTAANDE bestand/case kunnen brengen - als dat bestand al in een case
  // zit, naar de Cases-tab springen en die case meteen selecteren.
  function goToExistingItem(existingItem) {
    if (existingItem.case_id) {
      setFocusCaseId(existingItem.case_id)
      setTab('cases')
    } else {
      setTab('items')
    }
  }

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
        {tab === 'items' && <ItemsPage onGoToExisting={goToExistingItem} />}
        {tab === 'cases' && (
          <CasesPage
            focusCaseId={focusCaseId}
            onConsumeFocus={() => setFocusCaseId(null)}
            onGoToExisting={goToExistingItem}
          />
        )}
        {tab === 'contexts' && <ContextsPage />}
        {tab === 'contacts' && <ContactsPage />}
        {tab === 'knowledge' && <KnowledgePage />}
        {tab === 'commands' && <CommandsPage />}
      </main>
    </div>
  )
}
