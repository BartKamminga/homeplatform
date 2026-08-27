import { useState } from 'react'
import { api } from '@core/api.js'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989).
// flash: melding-functie uit useCmdQueue (zelfde toast-plek als de rest).
// onCmdQueueChanged: refresht de cmd-queue na een succesvolle start (smart-scan
// queuet direct commando's).
export function useSmartScan(flash, onCmdQueueChanged) {
  const [smartScan, setSmartScan] = useState({ active: false, mode: null, cmd_count: 0 })
  const [smartBusy, setSmartBusy] = useState(false)

  function loadSmartScan() { api.get('/api/hockey/smart-scan/status').then(setSmartScan).catch(() => {}) }

  function startSmartScan() {
    setSmartBusy(true)
    api.post('/api/hockey/smart-scan/start', {})
      .then(r => {
        loadSmartScan()
        onCmdQueueChanged?.()
        flash(r.added > 0 ? `Slim scannen gestart: ${r.type === 'scan_club' ? 'club ' + r.club : r.added + ' poules'} toegevoegd` : 'Niets te scannen')
      })
      .catch(() => {})
      .finally(() => setSmartBusy(false))
  }

  function stopSmartScan() {
    api.post('/api/hockey/smart-scan/stop', {}).then(() => setSmartScan(s => ({ ...s, active: false, mode: null }))).catch(() => {})
  }

  return { smartScan, smartBusy, loadSmartScan, startSmartScan, stopSmartScan }
}
