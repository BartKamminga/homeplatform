import { createContext, useContext } from 'react'

// Vervangt de handmatige prop-drilling DiscoveryCompetities → NameGroup →
// CompEntry (RFTR-B6, item 989, fase 6.2). Dit is de enige plek in de site
// waar Context wordt gebruikt - een echte recursieve boom met een vaste
// consumenten-set, geen precedent voor overal elders. Instantie-specifieke
// props (nm, nmComps, keyPrefix, showDistBadge / comp, nested, distBadge)
// blijven gewoon props.
const DiscoveryTreeContext = createContext(null)

export function DiscoveryTreeProvider({ value, children }) {
  return <DiscoveryTreeContext.Provider value={value}>{children}</DiscoveryTreeContext.Provider>
}

export function useDiscoveryTree() {
  const ctx = useContext(DiscoveryTreeContext)
  if (!ctx) throw new Error('useDiscoveryTree() moet binnen een <DiscoveryTreeProvider> gebruikt worden')
  return ctx
}
