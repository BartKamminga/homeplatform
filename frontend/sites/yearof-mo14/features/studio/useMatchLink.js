import { useState, useEffect } from 'react'
import { getLinkOverview } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Heeft deze wedstrijd een geldige wedstrijdlink (fans)? Voor de schakelaar
// Team/Fans boven de preview in de beheerstudio (item 1239). Ververst na elke
// opslag, dus ook zodra er een wedstrijdlink is gemaakt.
export default function useMatchLink(matchRef) {
  const [hasLink, setHasLink] = useState(false)
  useEffect(() => {
    if (!matchRef) { setHasLink(false); return }
    let alive = true
    const check = () => getLinkOverview()
      .then(o => { if (alive) setHasLink((o.match || []).some(l => l.match_ref === matchRef && l.status === 'active')) })
      .catch(() => {})
    check()
    const off = onDataChanged(check)
    return () => { alive = false; off() }
  }, [matchRef])
  return hasLink
}
