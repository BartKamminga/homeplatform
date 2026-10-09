import { useState, useEffect } from 'react'
import { getStandings } from '../../api.js'

// Logo van Victoria uit de pouletabel (eigen team = is_us) - voor de kop van
// de site. Gedeelde cache: 1 request per bezoek.
let logoPromise = null

export default function useClubLogo() {
  const [logo, setLogo] = useState(null)
  useEffect(() => {
    if (!logoPromise) {
      logoPromise = getStandings()
        .then(s => (s?.standings || []).find(r => r.is_us)?.club_logo_url || null)
        .catch(() => null)
    }
    let alive = true
    logoPromise.then(url => { if (alive) setLogo(url) })
    return () => { alive = false }
  }, [])
  return logo
}
