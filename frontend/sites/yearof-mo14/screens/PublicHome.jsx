import { useState, useEffect } from 'react'
import { getActionSettings } from '../api.js'
import Thermometer from './Thermometer.jsx'

export default function PublicHome({ onNavigate }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    getActionSettings().then(setSettings).catch(() => {})
  }, [])

  return (
    <div>
      <div className="yof-hero">
        <div style={{ fontSize: 32 }}>🇫🇷</div>
        <h1>Samen op naar Parijs!</h1>
        <p>Volg het team, bekijk de wedstrijden en steun de actie voor onze teamtrip.</p>
        <div style={{ marginTop: 16 }}>
          <Thermometer settings={settings} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('action')}>De actie &amp; doneren</button>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('spotlight')}>In de kijker</button>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('team')}>Het team bekijken</button>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('timeline')}>Wedstrijden &amp; bijzondere dagen</button>
        <button className="yof-btn" style={{ background: 'white', color: '#12203c' }}
          onClick={() => onNavigate('pinksterweekend')}>Pinksterweekend Parijs</button>
      </div>
    </div>
  )
}
