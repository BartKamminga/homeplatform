import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FietsLayout from './FietsLayout.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'

initSentry()
trackEvent('fiets', 'page.view', { path: window.location.pathname })
loadTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary label="FietsPrognose">
      <AuthGate site="fiets">
        <FietsLayout />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
