import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@core/theme.css'
import App from './App.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'

initSentry()
trackEvent('beatcrades', 'page.view', { path: window.location.pathname })
loadTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary label="BeatCrades">
      <AuthGate site="beatcrades">
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
