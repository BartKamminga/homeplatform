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
