import { useState, useEffect } from 'react'
import { getConceptBlocks, setBlockLive, checkPlatformAdmin, getBlockSettings, setBlockSettings } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Welke blokken in concept staan + of de bezoeker platformbeheerder is
// (item 1239). Gedeelde cache: elk PageBlock gebruikt deze hook, maar er gaat
// maar 1 request uit; na elke opslag (dataChanged) wordt opnieuw opgehaald.
let blocksPromise = null
let settingsPromise = null
let adminPromise = null
const listeners = new Set()

function loadBlocks() {
  if (!blocksPromise) {
    blocksPromise = getConceptBlocks().then(r => new Set(r.concept)).catch(() => new Set())
  }
  return blocksPromise
}

function loadSettings() {
  if (!settingsPromise) settingsPromise = getBlockSettings().catch(() => ({}))
  return settingsPromise
}

onDataChanged(() => {
  blocksPromise = null
  settingsPromise = null
  listeners.forEach(fn => fn())
})

export default function usePageBlocks() {
  const [conceptBlocks, setConceptBlocks] = useState(new Set())
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [settings, setSettingsState] = useState({})

  useEffect(() => {
    let alive = true
    const refresh = () => {
      loadBlocks().then(set => { if (alive) setConceptBlocks(set) })
      loadSettings().then(s => { if (alive) setSettingsState(s) })
    }
    refresh()
    if (!adminPromise) adminPromise = checkPlatformAdmin()
    adminPromise.then(v => { if (alive) setIsPlatformAdmin(v) })
    listeners.add(refresh)
    return () => { alive = false; listeners.delete(refresh) }
  }, [])

  // setBlockLive gaat via api.put en meldt zich dus zelf (dataChanged) -
  // alle PageBlocks halen daarna de nieuwe stand op.
  const setBlockState = (id, live) => setBlockLive(id, live)

  // Instellingen per blok (item 1248): setting(id, key, standaard) leest, setSetting schrijft.
  const setting = (id, key, fallback) => settings[id]?.[key] ?? fallback
  const setSetting = (id, key, value) => setBlockSettings(id, { [key]: value })

  return { conceptBlocks, isPlatformAdmin, setBlockState, settings, setting, setSetting }
}
