import { useState, useEffect } from 'react'
import { getCompetition, setCompetitionPublic, checkPlatformAdmin } from '../../api.js'

// Featureflag voor de Competitie-tab (items 1229-1232): zichtbaar voor
// bezoekers zodra hij vrijgegeven is, daarvoor alleen voor een ingelogde
// platformbeheerder - die ook als enige kan vrijgeven.
export default function useCompetitionAccess() {
  const [config, setConfig] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  useEffect(() => {
    getCompetition().then(setConfig).catch(() => {})
    checkPlatformAdmin().then(setIsPlatformAdmin)
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
