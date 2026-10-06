import { useState, useEffect } from 'react'
import { getSponsors } from '../api.js'

// Sponsors van de actie - publiek, geen teamcode nodig. Gedeeld door de
// actiepagina en de spelerslink voor vrienden (item 1186).
export default function SponsorList() {
  const [sponsors, setSponsors] = useState([])

  useEffect(() => {
    getSponsors().then(setSponsors).catch(() => {})
  }, [])

  if (sponsors.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Onze sponsors</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {sponsors.map(s => {
          // Sponsor zonder tekst: logo bevat vaak zelf al naam+tagline
          // (bv. Schade Professionals) - dan alleen het logo tonen i.p.v.
          // de naam er nog een keer naast te zetten.
          const card = s.description ? (
            <div className="yof-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {s.logo_url && (
                <img src={s.logo_url} alt={s.name} style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{s.description}</div>
              </div>
            </div>
          ) : (
            <div className="yof-card" style={{ display: 'flex', justifyContent: 'center' }}>
              {s.logo_url
                ? <img src={s.logo_url} alt={s.name} style={{ maxWidth: '100%', maxHeight: 70, objectFit: 'contain' }} />
                : <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>}
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
  )
}
