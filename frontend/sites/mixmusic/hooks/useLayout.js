import { useState } from 'react'

const DESKTOP_KEY = 'mm_desktop_layout'
const MOBILE_KEY  = 'mm_mobile_layout'

export function useLayout() {
  const [desktopLayout, setDesktopLayoutState] = useState(
    () => localStorage.getItem(DESKTOP_KEY) || 'C'
  )
  const [mobileLayout, setMobileLayoutState] = useState(
    () => localStorage.getItem(MOBILE_KEY) || 'C'
  )

  function setDesktopLayout(v) {
    localStorage.setItem(DESKTOP_KEY, v)
    setDesktopLayoutState(v)
  }

  function setMobileLayout(v) {
    localStorage.setItem(MOBILE_KEY, v)
    setMobileLayoutState(v)
  }

  return { desktopLayout, mobileLayout, setDesktopLayout, setMobileLayout }
}
