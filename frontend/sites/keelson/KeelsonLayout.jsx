import { useCallback, useEffect, useState } from 'react'
import { api } from '@core/api.js'
import { indexCatalog } from './model.js'
import SystemsPage from './pages/SystemsPage.jsx'
import SystemPage from './pages/SystemPage.jsx'
import MapPage from './pages/MapPage.jsx'
import CatalogPage from './pages/CatalogPage.jsx'

const TABS = [['systems', 'Systems'], ['map', 'Map'], ['catalog', 'Catalog']]

// Routes live in the hash: #systems, #system/<key>, #map, #map/<key>, #catalog
function readRoute() {
  const [tab, key] = window.location.hash.slice(1).split('/')
  if (tab === 'system' && key) return { tab: 'system', key }
  if (TABS.some(([k]) => k === tab)) return { tab, key: key || null }
  return { tab: 'systems', key: null }
}

export default function KeelsonLayout() {
  const [cat, setCat] = useState(null)
  const [systems, setSystems] = useState(null)
  const [route, setRoute] = useState(readRoute)
  const [error, setError] = useState('')

  const reloadSystems = useCallback(() => api.get('/api/keelson/systems').then(setSystems).catch((e) => setError(e.message)), [])

  useEffect(() => {
    api.get('/api/keelson/catalog').then((c) => setCat(indexCatalog(c))).catch((e) => setError(e.message))
    reloadSystems()
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [reloadSystems])

  const go = (tab, key = null) => { window.location.hash = key ? `${tab}/${key}` : tab }

  let body
  if (error) body = <div className="ks-page"><p className="ks-error">{error}</p></div>
  else if (!cat || !systems) body = <div className="ks-page"><p className="ks-muted">Loading the model…</p></div>
  else if (route.tab === 'system') {
    const summary = systems.find((s) => s.key === route.key)
    body = summary
      ? <SystemPage key={summary.id} cat={cat} systemId={summary.id} systems={systems} onChanged={reloadSystems} onOpenMap={() => go('map', summary.key)} />
      : <div className="ks-page"><p className="ks-muted">No system with key “{route.key}”.</p></div>
  } else if (route.tab === 'map') body = <MapPage cat={cat} systems={systems} systemKey={route.key} onPick={(k) => go('map', k)} onOpen={(k) => go('system', k)} />
  else if (route.tab === 'catalog') body = <CatalogPage cat={cat} />
  else body = <SystemsPage cat={cat} systems={systems} onOpen={(k) => go('system', k)} onCreated={async (k) => { await reloadSystems(); go('system', k) }} />

  const active = route.tab === 'system' ? 'systems' : route.tab
  return (
    <div className="ks">
      <header className="ks-bar">
        <a className="ks-brand" href="#systems">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M5 6l2 12h10l2-12M9 6v12M15 6v12M3 18h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          Keelson
        </a>
        <nav className="ks-tabs" aria-label="Sections">
          {TABS.map(([k, label]) => (
            <button key={k} id={`tab-${k}`} type="button" aria-pressed={active === k} onClick={() => go(k)}>{label}</button>
          ))}
        </nav>
        <span className="ks-spacer" />
        <span className="ks-muted ks-tagline">Every dimension of your systems</span>
      </header>
      <main className="ks-main">{body}</main>
    </div>
  )
}
