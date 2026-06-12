import { useUiPref } from '@core/useUiPref.js'

export function useLayout() {
  const [desktopLayout, setDesktopLayout] = useUiPref('mm_desktop_layout', 'C')
  const [mobileLayout,  setMobileLayout]  = useUiPref('mm_mobile_layout',  'C')
  return { desktopLayout, mobileLayout, setDesktopLayout, setMobileLayout }
}
