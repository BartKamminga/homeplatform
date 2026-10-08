import { useState, useEffect } from 'react'
import { getCompetition, setCompetitionPublic, checkPlatformAdmin, getConceptBlocks, setBlockLive } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Featureflag voor de Competitie-tab (items 1229-1232): zichtbaar voor
// bezoekers zodra hij vrijgegeven is, daarvoor alleen voor een ingelogde
// platformbeheerder - die ook als enige kan vrijgeven. Daarnaast per blok
// live/concept (item 1239): een blok in concept ziet alleen de beheerder.
export default function useCompetitionAccess() {
  const [config, setConfig] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [conceptBlocks, setConceptBlocks] = useState(new Set())

  useEffect(() => {
    // Opnieuw ophalen na elke opslag: in de beheerstudio staan de site en het
    // bewerkscherm naast elkaar, allebei met een eigen kopie van deze state.
    const load = () => {
      getCompetition().then(setConfig).catch(() => {})
      getConceptBlocks().then(r => setConceptBlocks(new Set(r.concept))).catch(() => {})
    }
    load()
    checkPlatformAdmin().then(setIsPlatformAdmin)
    return onDataChanged(load)
  }, [])

  async function setBlockState(id, live) {
    const r = await setBlockLive(id, live)
    setConceptBlocks(new Set(r.concept))
  }

  async function setPublic(pub) {
    await setCompetitionPublic(pub)
    setConfig(c => ({ ...c, public: pub }))
  }

  return {
    config,
    isPlatformAdmin,
    visible: !!config && (config.public || isPlatformAdmin),
    setPublic,
    conceptBlocks,
    setBlockState,
  }
}
