import { useState, useEffect } from 'react'
import { getActionSettings, getSponsors } from '../api.js'
import Thermometer from './Thermometer.jsx'

export default function PublicAction() {
  const [settings, setSettings] = useState(null)
  const [sponsors, setSponsors] = useState([])

  useEffect(() => {
    getActionSettings().then(setSettings).catch(() => {})
    getSponsors().then(setSponsors).catch(() => {})
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>De actie</h2>

      <div className="yof-card" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          MO14-1 gaat in het Pinksterweekend van 2027 samen op teamtrip naar Parijs.
          Om dat mogelijk te maken zamelt het team geld in — elk beetje helpt!
        </p>
      </div>

      <div style={{ background: '#12203c', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
        <Thermometer settings={settings} />
      </div>

      {settings?.donation_url && (
        <a className="yof-btn" href={settings.donation_url} target="_blank" rel="noreferrer"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 10 }}>
          Doneer aan de actie
        </a>
      )}
      {!settings?.donation_url && (
        <p style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>
          De donatielink volgt binnenkort.
        </p>
      )}

      {sponsors.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Onze sponsors</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {sponsors.map(s => {
              const card = (
                <div className="yof-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {s.logo_url && (
                    <img src={s.logo_url} alt={s.name} style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{s.description}</div>}
                  </div>
                </div>
              )
              return s.website_url ? (
                <a key={s.id} href={s.website_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {card}
                </a>
              ) : (
                <div key={s.id}>{card}</div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
