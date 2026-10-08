import { useState, useEffect } from 'react'
import { getCompetition, setCompetitionPublic, checkPlatformAdmin } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Featureflag voor de Competitie-tab (items 1229-1232): zichtbaar voor
// bezoekers zodra hij vrijgegeven is, daarvoor alleen voor een ingelogde
// platformbeheerder - die ook als enige kan vrijgeven. Blokken per pagina
// live/concept: zie features/blocks (item 1239).
export default function useCompetitionAccess() {
  const [config, setConfig] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  useEffect(() => {
    // Opnieuw ophalen na elke opslag: in de beheerstudio staan de site en het
    // bewerkscherm naast elkaar, allebei met een eigen kopie van deze state.
    const load = () => {
      getCompetition().then(setConfig).catch(() => {})
    }
    load()
    checkPlatformAdmin().then(setIsPlatformAdmin)
    return onDataChanged(load)
  }, [])

  async function setPublic(pub) {
    await setCompetitionPublic(pub)
    setConfig(c => ({ ...c, public: pub }))
  }

  return {
    config,
    isPlatformAdmin,
    visible: !!config && (config.public || isPlatformAdmin),
    setPublic,
  }
}
