import { useState } from 'react'
import { isTrackingDisabled, setTrackingDisabled } from '../tracking.js'
import AccessAdmin from './AccessAdmin.jsx'
import LinkPanel from './LinkPanel.jsx'

// Tabblad "Linkjes": sitelink beheren + overzicht van alle deelbare linkjes
// met bezoekcijfers (items 1186/1193). Uitleg en "niet meetellen" onderaan.
export default function LinksAdmin() {
  const [reloadKey, setReloadKey] = useState(0)
  const [noTrack, setNoTrack] = useState(isTrackingDisabled())

  function toggleNoTrack(checked) {
    setTrackingDisabled(checked)
    setNoTrack(checked)
  }

  return (
    <div>
      <AccessAdmin onChanged={() => setReloadKey(k => k + 1)} />

      <h3 style={{ fontSize: 15, margin: '24px 0 10px' }}>Alle linkjes en bezoeken</h3>
      <LinkPanel reloadKey={reloadKey} />

      <p style={{ fontSize: 12, color: '#666', margin: '20px 0 10px' }}>
        Geopend = elke keer dat een link geopend wordt, uniek = aantal verschillende apparaten.
        Bezoeken van beheerders (ingelogd, of op een apparaat met "niet meetellen") tellen niet
        mee en staan apart tussen haakjes, bijvoorbeeld 12 (3). Wedstrijd- en spelerslinks maak je
        bij de wedstrijd of de speler; ze zijn 10 dagen geldig.
      </p>
      <label style={{ display: 'block', fontSize: 12, padding: 10, background: '#f4f6fb', borderRadius: 8 }}>
        <input type="checkbox" checked={noTrack} onChange={e => toggleNoTrack(e.target.checked)} />
        {' '}<strong>Dit apparaat niet meetellen</strong>
        <div style={{ color: '#666', marginTop: 4 }}>
          Geldt per browser. WhatsApp opent linkjes vaak in een eigen browser: stuur jezelf
          daarom eenmalig deze link en open hem vanuit WhatsApp:
          <input readOnly value={`${window.location.origin}/yearof-mo14/?notrack=1`} onFocus={e => e.target.select()}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, fontSize: 11, padding: '3px 5px', borderRadius: 6, border: '1px solid #ddd' }} />
        </div>
      </label>
    </div>
  )
}
