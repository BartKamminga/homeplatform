import { useState, useEffect, useRef } from 'react'

// Breedte van de preview in de beheerstudio (item 1239): versleepbaar via de
// scheidingslijn, met snelkeuzes, en onthouden in localStorage.
const STORAGE_KEY = 'yof_studio_preview_width'
export const MIN_WIDTH = 320
const MIN_PANEL = 480 // ruimte die het bewerkscherm rechts altijd houdt
const GUTTER = 32     // marge rond de preview in de linkerkolom

const maxWidth = () => Math.max(MIN_WIDTH, window.innerWidth - MIN_PANEL - GUTTER)
const clamp = w => Math.round(Math.min(Math.max(w, MIN_WIDTH), maxWidth()))

export default function useResizableWidth(initial = 390) {
  const [width, setWidthState] = useState(() => clamp(Number(localStorage.getItem(STORAGE_KEY)) || initial))
  const dragging = useRef(false)

  function setWidth(w) {
    const next = clamp(w)
    setWidthState(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      setWidth(e.clientX - GUTTER)
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    const onResize = () => setWidthState(w => clamp(w))
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  function startDrag(e) {
    e.preventDefault()
    dragging.current = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }

  return { width, setWidth, startDrag, maxWidth, gutter: GUTTER }
}
