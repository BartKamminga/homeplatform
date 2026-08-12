import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@core/theme.css'
import App from './App.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'
import EnvBanner from '@core/EnvBanner.jsx'

initSentry()
trackEvent('hockey-inside', 'page.view', { path: window.location.pathname })
loadTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/hockey-inside/sw.js', { scope: '/hockey-inside/' })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="Hockey Inside">
      <AuthGate site="hockey-inside">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
