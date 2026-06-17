import { useUiPref } from '@core/useUiPref.js'

export function useLayout() {
  const [mobileLayout, setMobileLayout] = useUiPref('mm_mobile_layout', 'C')
  return { mobileLayout, setMobileLayout }
}
