import { useCallback, useEffect, useState } from 'react'
import { api } from '@core/api.js'
import SourcesPanel from './components/SourcesPanel.jsx'
import ModelPage from './pages/ModelPage.jsx'
import RoomsPage from './pages/RoomsPage.jsx'
import DevicesPage from './pages/DevicesPage.jsx'
import InputsPage from './pages/InputsPage.jsx'
import ApiPage from './pages/ApiPage.jsx'
import PushPage from './pages/PushPage.jsx'

const TABS = [['model', 'Model'], ['rooms', 'Rooms'], ['devices', 'Devices'], ['inputs', 'Inputs'], ['push', 'Push to HA'], ['api', 'API']]
const initialTab = () => {
  const h = window.location.hash.slice(1)
  return TABS.some(([k]) => k === h) ? h : 'model'
}

export default function MyHomeLayout() {
  const [homes, setHomes] = useState(null)
  const [homeId, setHomeId] = useState(null)
  const [home, setHome] = useState(null)
  const [sources, setSources] = useState([])
  const [notes, setNotes] = useState([])
  const [tab, setTab] = useState(initialTab)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [devFilter, setDevFilter] = useState('all')

  useEffect(() => {
    api.get('/api/myhome/homes')
      .then((list) => { setHomes(list); if (list[0]) setHomeId(list[0].id) })
      .catch((e) => setError(e.message))
  }, [])

  const reload = useCallback(async () => {
    if (!homeId) return
    try {
      const [h, s, n] = await Promise.all([
        api.get(`/api/myhome/homes/${homeId}`),
        api.get(`/api/myhome/homes/${homeId}/sources`),
        api.get(`/api/myhome/homes/${homeId}/notes`),
      ])
      setHome(h); setSources(s); setNotes(n)
    } catch (e) {
      setError(e.message)
    }
  }, [homeId])

  useEffect(() => { reload() }, [reload])

  const go = (key) => { if (key !== 'devices') setDevFilter('all'); setTab(key); window.history.replaceState(null, '', `#${key}`) }

  async function createHome(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const h = await api.post('/api/myhome/homes', { name: newName.trim() })
      setHomes([...(homes || []), { id: h.id, name: h.name }])
      setHomeId(h.id)
      go('inputs')
    } catch (err) {
      setError(err.message)
    }
  }

  let body
  if (error && !home) body = <div className="mh-page"><p className="mh-error">{error}</p></div>
  else if (homes && !homes.length) {
    body = (
      <div className="mh-page">
        <h2>Start with your home</h2>
        <p className="mh-muted">Give it a name, then add floor plans and photos. The rooms, devices and connections grow from there.</p>
        <form className="mh-row" onSubmit={createHome}>
          <input id="home-name" placeholder="e.g. Our house" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Home name" />
          <button className="mh-btn" type="submit">Create home</button>
        </form>
      </div>
    )
  } else if (!home) body = <div className="mh-page"><p className="mh-muted">Loading your home…</p></div>
  else if (tab === 'model') body = <ModelPage home={home} sources={sources} onReload={reload} onHomeChange={setHome} />
  else if (tab === 'rooms') body = <RoomsPage home={home} onChange={setHome} />
  else if (tab === 'devices') body = <DevicesPage key={devFilter} home={home} onReload={reload} initialFilter={devFilter} />
  else if (tab === 'inputs') body = <InputsPage home={home} sources={sources} notes={notes} onReload={reload} onHomeChange={setHome} />
  else if (tab === 'push') body = <PushPage home={home} onReload={reload} />
  else body = <ApiPage home={home} />

  return (
    <div className="mh">
      <header className="mh-bar">
        <h1 className="mh-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          MyHome<span>.io</span>
        </h1>
        {homes?.length > 1 && (
          <select id="home-pick" value={homeId || ''} onChange={(e) => setHomeId(e.target.value)} aria-label="Home">
            {homes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
        {homes?.length === 1 && <span className="mh-muted">{homes[0].name}</span>}
        {home && (
          <nav className="mh-tabs" aria-label="Sections">
            {TABS.map(([k, label]) => (
              <button key={k} id={`tab-${k}`} aria-pressed={tab === k} onClick={() => go(k)}>{label}</button>
            ))}
          </nav>
        )}
        <span className="mh-spacer" />
        <a className="mh-link" href="/account/groups?back=/myhome/">Account</a>
      </header>
      {home?.review_count > 0 && (
        <div className="mh-banner" role="status">
          <strong>{home.review_count} new device{home.review_count === 1 ? '' : 's'} found</strong>
          <span>in Home Assistant / Hue. Tell us what and where they are.</span>
          <button className="mh-btn" onClick={() => { setDevFilter('new'); go('devices') }}>Review</button>
        </div>
      )}
      <div className="mh-main">
        <main className="mh-content">{body}</main>
        <SourcesPanel home={home} sources={sources} />
      </div>
    </div>
  )
}
