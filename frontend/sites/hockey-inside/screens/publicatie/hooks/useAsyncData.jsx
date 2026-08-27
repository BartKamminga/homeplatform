import { useState, useEffect } from 'react'

// Generieke fetch-laad-render-skelet (RFTR-B6, item 989, fase 6.5) -
// StandenTab/ProgrammaTab/UitslagenTab (CompetitieDetailView.jsx) hadden
// alle drie hetzelfde loading/error-patroon, alleen met een andere fetchFn.
export function useAsyncData(fetchFn, deps, emptyValue) {
  const [data, setData] = useState(emptyValue)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchFn().then(setData).catch(() => setData(emptyValue)).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading }
}
