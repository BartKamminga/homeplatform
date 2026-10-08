import { useState, useEffect } from 'react'
import { getCustomPages } from '../../api.js'
import { onDataChanged } from '../../dataChanged.js'

// Eigen pagina's (max 3, item 1239) - gedeelde cache zoals usePageBlocks:
// 1 request, opnieuw ophalen na elke opslag.
let pagesPromise = null
const listeners = new Set()

function loadPages() {
  if (!pagesPromise) pagesPromise = getCustomPages().catch(() => [])
  return pagesPromise
}

onDataChanged(() => {
  pagesPromise = null
  listeners.forEach(fn => fn())
})

export const MAX_CUSTOM_PAGES = 3
export const pageRef = id => `page:${id}`

// In de kijker (item 1241): vaste pagina, telt niet mee in de max 3, werkt
// verder hetzelfde (eigen berichten onder page:spotlight, kop, live/concept).
export const SPOTLIGHT_PAGE = {
  id: 'spotlight', label: 'In de kijker', icon: '⭐', title: 'In de kijker',
  subtitle: 'Interviews, verslagen en nieuws van het team.', fixed: true,
}

// "page:<id>" -> view in PublicSite ({ name: 'spotlight' } of { name: 'custom', id })
export function viewForPageRef(ref) {
  const id = ref?.startsWith('page:') ? ref.slice(5) : null
  if (!id) return null
  return id === SPOTLIGHT_PAGE.id ? { name: 'spotlight' } : { name: 'custom', id }
}

export default function useCustomPages() {
  const [pages, setPages] = useState([])
  useEffect(() => {
    let alive = true
    const refresh = () => loadPages().then(p => { if (alive) setPages(p) })
    refresh()
    listeners.add(refresh)
    return () => { alive = false; listeners.delete(refresh) }
  }, [])
  return pages
}
