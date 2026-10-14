import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import VariantRoot from '@components/VariantRoot.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'
import EnvBanner from '@core/EnvBanner.jsx'
import '@core/theme.css'

// Twee frontends naast elkaar (item 1337): classic (FietsLayout) en arcade, keuze per gebruiker.
const Classic = lazy(() => import('./ClassicRoot.jsx'))
const Arcade = lazy(() => import('./arcade/ArcadeRoot.jsx'))

initSentry()
trackEvent('fiets', 'page.view', { path: window.location.pathname })
loadTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fiets/sw.js', { scope: '/fiets/' })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="FietsPrognose">
      <AuthGate site="fiets">
        <VariantRoot site="fiets" classic={Classic} arcade={Arcade} />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
