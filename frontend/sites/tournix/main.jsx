import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@core/theme.css'
import App from './App.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'

initSentry()
trackEvent('tournix', 'page.view', { path: window.location.pathname })
loadTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/tournix/sw.js', { scope: '/tournix/' })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary label="Tournix">
      <AuthGate site="tournix">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
