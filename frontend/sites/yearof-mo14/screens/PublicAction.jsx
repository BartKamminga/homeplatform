import { useState, useEffect } from 'react'
import { getActionSettings } from '../api.js'
import Thermometer from './Thermometer.jsx'

export default function PublicAction() {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    getActionSettings().then(setSettings).catch(() => {})
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
    </div>
  )
}
