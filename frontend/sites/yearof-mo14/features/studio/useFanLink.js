import { useState, useEffect } from 'react'
import { getLinkOverview } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Geldige fan-link voor deze wedstrijd (kind 'match', id = match_ref) of
// speelster (kind 'player', id = player_id)? Voor de schakelaar Team/Fans boven
// de preview in de beheerstudio (item 1239). Geeft de code terug (of null);
// ververst na elke opslag, dus ook zodra er een link is gemaakt.
export default function useFanLink(kind, id) {
  const [code, setCode] = useState(null)
  useEffect(() => {
    if (!id) { setCode(null); return }
    let alive = true
    const field = kind === 'match' ? 'match_ref' : 'player_id'
    const check = () => getLinkOverview()
      .then(o => {
        const link = (o[kind] || []).find(l => l[field] === id && l.status === 'active')
        if (alive) setCode(link ? link.code : null)
      })
      .catch(() => {})
    check()
    const off = onDataChanged(check)
    return () => { alive = false; off() }
  }, [kind, id])
  return code
}
