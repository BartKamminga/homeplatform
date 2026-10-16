import { useCallback, useEffect, useState } from 'react'
import { getInbox, listOutbox } from './api.js'
import DossierListPage from './pages/DossierListPage.jsx'
import DossierPage from './pages/DossierPage.jsx'
import InboxPage from './pages/InboxPage.jsx'
import OutboxPage from './pages/OutboxPage.jsx'

// Routes live in the hash: #  (list)  ·  #inbox  ·  #outbox  ·  #d/<slug>  (one dossier)
function readRoute() {
  const [view, slug] = window.location.hash.slice(1).split('/')
  if (view === 'd' && slug) return { view: 'dossier', slug: decodeURIComponent(slug) }
  return { view: ['inbox', 'outbox'].includes(view) ? view : 'list', slug: null }
}

export default function DossiersLayout() {
  const [route, setRoute] = useState(readRoute)
  const [pending, setPending] = useState(0)
  const [outbox, setOutbox] = useState(0)

  const refreshPending = useCallback(() => {
    getInbox().then((b) => setPending(b.dossiers.length + b.entries.length)).catch(() => {})
    listOutbox('open').then((l) => setOutbox(l.length)).catch(() => {})
  }, [])
  useEffect(() => { refreshPending() }, [refreshPending, route])

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const open = (slug) => { window.location.hash = slug ? `d/${encodeURIComponent(slug)}` : '' }
  const go = (view) => { window.location.hash = view === 'list' ? '' : view }

  return (
    <div className="ds">
      <header className="ds-bar">
        <a className="ds-brand" href="#" onClick={(e) => { e.preventDefault(); open(null) }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7h6l2 2h10v10H3z M3 7V5h6l2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          Dossiers
        </a>
        <nav className="ds-tabs" aria-label="Sections">
          <button type="button" aria-pressed={route.view === 'list' || route.view === 'dossier'} onClick={() => go('list')}>Dossiers</button>
          <button type="button" aria-pressed={route.view === 'inbox'} onClick={() => go('inbox')}>
            Inbox{pending > 0 && <span className="ds-badge">{pending}</span>}
          </button>
          <button type="button" aria-pressed={route.view === 'outbox'} onClick={() => go('outbox')}>
            Outbox{outbox > 0 && <span className="ds-badge">{outbox}</span>}
          </button>
        </nav>
        <span className="ds-spacer" />
        <span className="ds-muted ds-tagline">Everything about one question, in one place</span>
      </header>
      <main className="ds-main">
        {route.view === 'dossier' && <DossierPage key={route.slug} slug={route.slug} onBack={() => open(null)} />}
        {route.view === 'inbox' && <InboxPage onOpen={open} onChanged={setPending} />}
        {route.view === 'outbox' && <OutboxPage onChanged={setOutbox} />}
        {route.view === 'list' && <DossierListPage onOpen={open} />}
      </main>
    </div>
  )
}
