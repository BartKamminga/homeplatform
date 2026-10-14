import { Suspense, useEffect, useMemo } from 'react'
import { getVariant, syncVariant } from '@core/uiVariant.js'

// Laadt per pageload precies één frontend-variant (item 1336). classic en arcade zijn React.lazy-componenten,
// zodat Vite JS en CSS per variant splitst en de stijlen elkaar niet raken.
export default function VariantRoot({ site, classic: Classic, arcade: Arcade }) {
  const variant = useMemo(() => getVariant(site), [site])

  useEffect(() => { syncVariant(site, variant) }, [site, variant])

  const Comp = variant === 'arcade' ? Arcade : Classic
  return (
    <Suspense fallback={null}>
      <Comp />
    </Suspense>
  )
}
