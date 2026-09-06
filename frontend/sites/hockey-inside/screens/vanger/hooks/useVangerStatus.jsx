import { useState } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989): live Scout/Ghost-
// status + de Ghost/Scout/scan-plan-triggers en -toggles.
// flash: melding-functie uit useCmdQueue (zelfde toast-plek als de rest).
export function useVangerStatus(flash) {
  const [vangerStatus, setVangerStatus] = useState(null)
  const [ghostBusy,    setGhostBusy]    = useState(false)
  const [scoutBusy,    setScoutBusy]    = useState(false)

  function loadVangerStatus() { api.get('/api/hockey/vanger/status').then(setVangerStatus).catch(() => {}) }

  function triggerGhost() {
    setGhostBusy(true)
    api.post('/api/hockey/vanger/ghost/trigger', {})
      .then(() => flash('Ghost gestart — kan tot een paar minuten duren voor de eerste heartbeat.'))
      .catch(() => flash('Ghost starten mislukt'))
      .finally(() => setGhostBusy(false))
  }

  function toggleGhostEnabled() {
    api.post('/api/hockey/vanger/ghost/toggle', {})
      .then(r => { flash(r.enabled ? 'Ghost weer aangezet' : 'Ghost uitgeschakeld — reageert niet meer op triggers'); loadVangerStatus() })
      .catch(() => {})
  }

  function toggleScanPlanEnabled() {
    api.post('/api/hockey/vanger/scan-plan/toggle', {})
      .then(r => { flash(r.enabled ? 'Scan-plan weer aangezet' : 'Scan-plan uitgeschakeld — queuet niets meer automatisch'); loadVangerStatus() })
      .catch(() => {})
  }

  function triggerScout() {
    setScoutBusy(true)
    api.post('/api/hockey/vanger/scout/trigger', {})
      .then(() => flash('Scout-start aangevraagd — moet binnen 15s oppikken zolang de extensie open staat.'))
      .catch(() => flash('Scout starten mislukt'))
      .finally(() => setScoutBusy(false))
  }

  return {
    vangerStatus, ghostBusy, scoutBusy, loadVangerStatus,
    triggerGhost, triggerScout, toggleGhostEnabled, toggleScanPlanEnabled,
  }
}
