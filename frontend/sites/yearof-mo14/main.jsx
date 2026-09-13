import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@core/theme.css'
import App from './App.jsx'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import { trackEvent, loadTheme } from '@core/api.js'
import { initSentry } from '@core/sentry.js'
import EnvBanner from '@core/EnvBanner.jsx'

initSentry()
trackEvent('yearof-mo14', 'page.view', { path: window.location.pathname })
loadTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EnvBanner />
    <ErrorBoundary label="MO14 à Paris">
      <App />
    </ErrorBoundary>
  </StrictMode>
)
