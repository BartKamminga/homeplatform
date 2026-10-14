import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@core/theme.css'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import VariantRoot from '@components/VariantRoot.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'
import EnvBanner from '@core/EnvBanner.jsx'

// Twee frontends naast elkaar (item 1338): classic (App.jsx) en arcade, keuze per gebruiker.
const Classic = lazy(() => import('./ClassicRoot.jsx'))
const Arcade = lazy(() => import('./arcade/ArcadeRoot.jsx'))

initSentry()
trackEvent('beatcrades', 'page.view', { path: window.location.pathname })
loadTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/beatcrades/sw.js', { scope: '/beatcrades/' })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="BeatCrades">
      <AuthGate site="beatcrades">
        <VariantRoot site="beatcrades" classic={Classic} arcade={Arcade} />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
