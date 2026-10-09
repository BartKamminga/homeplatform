import { useState, useEffect } from 'react'
import { getPlayerCards } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Live spelerskaarten per speelster (player_id -> kaart), gedeeld: 1 request
// voor alle kaarten op een pagina, opnieuw na een opslag (studio-preview).
let cache = null
const listeners = new Set()

function load() {
  cache = getPlayerCards()
    .then(rows => Object.fromEntries(rows.map(c => [c.player_id, c])))
    .catch(() => ({}))
  cache.then(map => listeners.forEach(l => l(map)))
  return cache
}

if (typeof window !== 'undefined') onDataChanged(() => { if (listeners.size) load() })

export default function usePlayerCards() {
  const [cards, setCards] = useState({})
  useEffect(() => {
    listeners.add(setCards)
    ;(cache || load()).then(setCards)
    return () => { listeners.delete(setCards) }
  }, [])
  return cards
}
