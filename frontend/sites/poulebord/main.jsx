import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'

initSentry()
trackEvent('poulebord', 'page.view', { path: window.location.pathname })
loadTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/poulebord/sw.js', { scope: '/poulebord/' })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary label="Poulebord">
      <AuthGate site="poulebord" siteName="Poulebord">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
