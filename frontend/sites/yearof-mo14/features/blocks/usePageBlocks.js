import { useState, useEffect } from 'react'
import { getConceptBlocks, setBlockLive, checkPlatformAdmin } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Welke blokken in concept staan + of de bezoeker platformbeheerder is
// (item 1239). Gedeelde cache: elk PageBlock gebruikt deze hook, maar er gaat
// maar 1 request uit; na elke opslag (dataChanged) wordt opnieuw opgehaald.
let blocksPromise = null
let adminPromise = null
const listeners = new Set()

function loadBlocks() {
  if (!blocksPromise) {
    blocksPromise = getConceptBlocks().then(r => new Set(r.concept)).catch(() => new Set())
  }
  return blocksPromise
}

onDataChanged(() => {
  blocksPromise = null
  listeners.forEach(fn => fn())
})

export default function usePageBlocks() {
  const [conceptBlocks, setConceptBlocks] = useState(new Set())
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  useEffect(() => {
    let alive = true
    const refresh = () => loadBlocks().then(set => { if (alive) setConceptBlocks(set) })
    refresh()
    if (!adminPromise) adminPromise = checkPlatformAdmin()
    adminPromise.then(v => { if (alive) setIsPlatformAdmin(v) })
    listeners.add(refresh)
    return () => { alive = false; listeners.delete(refresh) }
  }, [])

  // setBlockLive gaat via api.put en meldt zich dus zelf (dataChanged) -
  // alle PageBlocks halen daarna de nieuwe stand op.
  const setBlockState = (id, live) => setBlockLive(id, live)

  return { conceptBlocks, isPlatformAdmin, setBlockState }
}
