import { useState, useEffect } from 'react'
import { getCompetition, setCompetitionPublic, checkPlatformAdmin } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Featureflags voor de tabs Competitie en Topklasse, elk apart (items 1229-1232, 1239): live =
// zichtbaar in het menu, concept = nergens op de site (ook niet voor de
// beheerder, item 1239) - alleen in het bewerkscherm van de beheerstudio,
// waar de platformbeheerder hem live zet. Blokken: zie features/blocks.
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

  // page: 'competition' | 'topklasse'
  async function setPublic(page, pub) {
    await setCompetitionPublic(pub, page)
    setConfig(c => ({ ...c, [page === 'topklasse' ? 'topklasse_public' : 'public']: pub }))
  }

  return {
    config,
    isPlatformAdmin,
    visible: !!config && config.public,
    topklasseVisible: !!config && config.topklasse_public,
    setPublic,
  }
}
