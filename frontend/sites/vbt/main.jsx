// VBT — Virtual Bike Trainer. De game is vanilla canvas-JS (globale VBT-namespace); de modules hieronder
// worden in deze volgorde uitgevoerd. React wordt alleen gebruikt voor de HomePlatform-login (AuthGate).
import './css/style.css'
import './css/plan.css'
import './css/panels.css'

import './game/config.js'
import './game/util.js'
import './game/settings.js'
import './game/store.js'
import './game/sprites.js'
import './game/track.js'
import './game/background.js'
import './game/terrain.js'
import './game/road.js'
import './game/rider.js'
import './game/physics.js'
import './game/peloton.js'
import './game/game.js'
import './game/recorder.js'
import './game/safety.js'
import './game/storage.js'
import './game/storage-api.js'
import './game/fit.js'
import './game/workout.js'
import './game/ftp.js'
import './game/calendar.js'
import './game/library.js'
import './game/climbs.js'
import './game/rides.js'
import './game/ble-parse.js'
import './game/ble.js'
import './game/ble-mock.js'
import './game/ble-bridge.js'
import './game/vehicles.js'
import './game/coach.js'
import './game/traffic.js'
import './game/hud.js'
import './game/workout-hud.js'
import './game/session.js'
import './game/strava-ui.js'
import './game/actions.js'
import './game/main.js'

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
