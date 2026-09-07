// Gedeeld tussen StackedTimelineChart.jsx en RankingBarChart.jsx. CSS-variabelen
// (--color-primary, --color-border, ...) resolven niet betrouwbaar via var(...)
// binnen SVG-attributen in deze codebase - dat gaf al eens een onzichtbare
// grafiek (zie fiets/components/SmoothChart.jsx). Daarom hier runtime-resolutie
// via getComputedStyle en doorgeven als letterlijke hex/rgba-waarden.
import { useEffect, useState } from 'react'

const THEME_VARS = ['--color-primary', '--color-border', '--color-text', '--color-text-muted', '--color-surface']

const FALLBACK_COLORS = {
  '--color-primary': '#ff3e6c',
  '--color-border': 'rgba(0,0,0,0.1)',
  '--color-text': '#1a1a1a',
  '--color-text-muted': 'rgba(26,26,26,0.55)',
  '--color-surface': '#f0eeea',
}

export function useThemeColors() {
  const [colors, setColors] = useState(FALLBACK_COLORS)
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const next = {}
      THEME_VARS.forEach(v => { next[v] = cs.getPropertyValue(v).trim() || FALLBACK_COLORS[v] })
      setColors(next)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return colors
}

// Neutrale grijstint voor reason-keys die niet in REASON_META voorkomen
// (defensief - kan gebeuren zodra er een nieuwe scan-reason bijkomt die nog
// niet in reasonMeta.js is opgenomen) en voor de "Other"-foldgroep zodra er
// meer dan MAX_INDIVIDUAL_SERIES gelijktijdige reasons zijn. Zelfde grijs als
// new_or_empty in reasonMeta.js.
export const NEUTRAL_COLOR = '#94a3b8'
