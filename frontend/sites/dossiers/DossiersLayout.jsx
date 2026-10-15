import { useEffect, useState } from 'react'
import DossierListPage from './pages/DossierListPage.jsx'
import DossierPage from './pages/DossierPage.jsx'

// Routes live in the hash: #  (list)  ·  #d/<slug>  (one dossier)
function readRoute() {
  const [view, slug] = window.location.hash.slice(1).split('/')
  return view === 'd' && slug ? { slug: decodeURIComponent(slug) } : { slug: null }
}

export default function DossiersLayout() {
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const open = (slug) => { window.location.hash = slug ? `d/${encodeURIComponent(slug)}` : '' }

  return (
    <div className="ds">
      <header className="ds-bar">
        <a className="ds-brand" href="#" onClick={(e) => { e.preventDefault(); open(null) }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7h6l2 2h10v10H3z M3 7V5h6l2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          Dossiers
        </a>
        <span className="ds-spacer" />
        <span className="ds-muted ds-tagline">Everything about one question, in one place</span>
      </header>
      <main className="ds-main">
        {route.slug
          ? <DossierPage key={route.slug} slug={route.slug} onBack={() => open(null)} />
          : <DossierListPage onOpen={open} />}
      </main>
    </div>
  )
}
