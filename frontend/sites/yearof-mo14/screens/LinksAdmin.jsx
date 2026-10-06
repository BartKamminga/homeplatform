import { useState, useEffect } from 'react'
import { getLinkOverview } from '../api.js'
import { isTrackingDisabled, setTrackingDisabled } from '../tracking.js'
import AccessAdmin from './AccessAdmin.jsx'
import LinkOverview from './LinkOverview.jsx'

// Tabblad "Linkjes": sitelink beheren + overzicht van alle deelbare linkjes
// met bezoekcijfers (items 1186/1193).
export default function LinksAdmin() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [noTrack, setNoTrack] = useState(isTrackingDisabled())

  function load() {
    getLinkOverview().then(setOverview).catch(e => setError(e.message))
  }
  useEffect(load, [])

  function toggleNoTrack(checked) {
    setTrackingDisabled(checked)
    setNoTrack(checked)
  }

  return (
    <div>
      <AccessAdmin onChanged={load} />

      <h3 style={{ fontSize: 15, margin: '24px 0 6px' }}>Alle linkjes en bezoeken</h3>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>
        Geopend = elke keer dat een link geopend wordt, uniek = aantal verschillende apparaten.
        Bezoeken van ingelogde beheerders tellen niet mee. Wedstrijd- en spelerslinks maak je
        bij de wedstrijd of de speler; ze zijn 10 dagen geldig.
      </p>
      <label style={{ display: 'block', fontSize: 12, padding: 10, background: '#f4f6fb', borderRadius: 8, marginBottom: 14 }}>
        <input type="checkbox" checked={noTrack} onChange={e => toggleNoTrack(e.target.checked)} />
        {' '}<strong>Dit apparaat niet meetellen</strong>
        <div style={{ color: '#666', marginTop: 4 }}>
          Geldt per browser. WhatsApp opent linkjes vaak in een eigen browser: stuur jezelf
          daarom eenmalig deze link en open hem vanuit WhatsApp:
          <input readOnly value={`${window.location.origin}/yearof-mo14/?notrack=1`} onFocus={e => e.target.select()}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, fontSize: 11, padding: '3px 5px', borderRadius: 6, border: '1px solid #ddd' }} />
        </div>
      </label>

      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {overview ? <LinkOverview overview={overview} onChanged={load} /> : !error && <p style={{ fontSize: 13 }}>Laden...</p>}
    </div>
  )
}
