import { useState, useEffect, useRef } from 'react'
import PrognosePage from './pages/PrognosePage.jsx'
import InstellingenPage from './pages/InstellingenPage.jsx'
import DebugPage from './pages/DebugPage.jsx'
import { t, useLanguage } from './i18n.js'

export default function FietsLayout() {
  const [version, setVersion] = useState('')
  const [view, setView] = useState('prognose')
  const [lang, setLang] = useLanguage()
  const debugLeaveGuard = useRef(null)

  function goTo(nextView) {
    if (view === 'debug' && debugLeaveGuard.current) debugLeaveGuard.current()
    setView(nextView)
  }

  useEffect(() => {
    fetch('/api/changelog?site=fiets')
      .then(r => r.json())
      .then(data => { if (data[0]) setVersion(data[0].version) })
      .catch(() => {})
  }, [])

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--color-background)',
      color: 'var(--color-text)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--color-background)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🚴</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>FietsPrognose</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>v{version}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => goTo(view === 'debug' ? 'prognose' : 'debug')}
            aria-label={t(lang, 'nav.debug')}
            style={{
              fontSize: 15, padding: '6px 10px', cursor: 'pointer',
              border: '1px solid var(--color-border)', borderRadius: 8,
              background: 'transparent', lineHeight: 1,
              color: view === 'debug' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >🔬</button>
          <button
            onClick={() => goTo(view === 'instellingen' ? 'prognose' : 'instellingen')}
            aria-label={t(lang, 'nav.settings')}
            style={{
              fontSize: 15, padding: '6px 10px', cursor: 'pointer',
              border: '1px solid var(--color-border)', borderRadius: 8,
              background: 'transparent', lineHeight: 1,
              color: view === 'instellingen' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >⚙️</button>
          <a
            href="/account/groups?back=/fiets/"
            onClick={() => { if (view === 'debug' && debugLeaveGuard.current) debugLeaveGuard.current() }}
            style={{
              fontSize: 12, color: 'var(--color-text-muted)',
              textDecoration: 'none', padding: '6px 10px',
              border: '1px solid var(--color-border)', borderRadius: 8,
            }}
          >{t(lang, 'nav.account')}</a>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {view === 'prognose' && <PrognosePage lang={lang} />}
        {view === 'instellingen' && <InstellingenPage lang={lang} onLangChange={setLang} />}
        {view === 'debug' && <DebugPage lang={lang} onBeforeLeave={debugLeaveGuard} />}
      </main>
    </div>
  )
}
