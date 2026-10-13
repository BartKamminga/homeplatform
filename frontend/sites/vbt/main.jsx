// VBT — Virtual Bike Trainer. De game is vanilla canvas-JS (globale VBT-namespace); de modules hieronder
// worden in deze volgorde uitgevoerd. React wordt alleen gebruikt voor de HomePlatform-login (AuthGate).
import './css/style.css'
import './css/screens.css'
import './css/panels.css'
import './css/features.css'

import './engine/config.js'
import './engine/util.js'
import './engine/settings.js'
import './engine/store.js'
import './engine/sprites.js'
import './engine/track.js'
import './engine/background.js'
import './engine/terrain.js'
import './engine/road.js'
import './engine/rider.js'
import './engine/physics.js'
import './engine/peloton.js'
import './engine/game.js'
import './engine/recorder.js'
import './engine/safety.js'
import './engine/storage.js'
import './engine/storage-api.js'
import './engine/fit.js'
import './engine/workout.js'
import './engine/ftp.js'
import './engine/calendar.js'
import './engine/climbs.js'
import './engine/ble-parse.js'
import './engine/ble.js'
import './engine/ble-mock.js'
import './engine/ble-bridge.js'
import './engine/vehicles.js'
import './engine/coach.js'
import './engine/traffic.js'
import './engine/hud.js'
import './engine/workout-hud.js'
import './engine/session.js'
import './engine/actions.js'
import './engine/main.js'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '@components/ErrorBoundary.jsx'
import AuthGate from '@components/AuthGate.jsx'
import { trackEvent } from '@core/api.js'
import { initSentry } from '@core/sentry.js'

initSentry()
trackEvent('vbt', 'page.view', { path: window.location.pathname })

import VbtApp from './ui/VbtApp.jsx'

createRoot(document.getElementById('vbt-gate')).render(
  <StrictMode>
    <ErrorBoundary label="VBT">
      <AuthGate site="vbt" siteName="VBT">
        <VbtApp />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>
)
