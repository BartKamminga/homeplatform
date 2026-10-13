import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MyHomeLayout from './MyHomeLayout.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'
import EnvBanner from '@core/EnvBanner.jsx'
import '@core/theme.css'
import './myhome.css'

initSentry()
trackEvent('myhome', 'page.view', { path: window.location.pathname })
loadTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="MyHome">
      <AuthGate site="myhome">
        <MyHomeLayout />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
