import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import StandaloneBoardView from './StandaloneBoardView.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'
import EnvBanner from '@core/EnvBanner.jsx'

initSentry()
trackEvent('poulebord', 'page.view', { path: window.location.pathname })
loadTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/poulebord/sw.js', { scope: '/poulebord/' })
  })
}

// Een gedeeld bordlinkje (?b=CODE) moet zonder homeplatform-login werken -
// alleen dat ene board is dan zichtbaar, buiten AuthGate om, zodat de rest
// van Poulebord (browsen/zoeken) achter login blijft.
const boardCode = new URLSearchParams(window.location.search).get('b')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="Poulebord">
      {boardCode ? (
        <StandaloneBoardView code={boardCode} />
      ) : (
        <AuthGate site="poulebord" siteName="Poulebord">
          <App />
        </AuthGate>
      )}
    </ErrorBoundary>
  </StrictMode>
)
