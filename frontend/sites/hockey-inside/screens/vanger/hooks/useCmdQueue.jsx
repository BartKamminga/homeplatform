import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { useQueueCmd } from '../../queueShared.jsx'
import { useCollapse } from '../../ui.jsx'

// Uitgesplitst uit useVangerState.jsx (RFTR-B6, item 989): de cmd-queue zelf
// + de fillMsg-toastmelding, die vanuit meerdere andere Vanger-hooks
// (smart-scan, vanger-status, vanger-settings) via `flash()` wordt gebruikt -
// dat is de enige plek waar de melding zichtbaar is (CmdQueueSection), dus
// blijft de state hier in plaats van in een aparte gedeelde hook.
export function useCmdQueue(confirm) {
  const [cmdQueue,   setCmdQueue]   = useState(null)
  const [cmdFilling, setCmdFilling] = useState(null)
  const [cmdOpen,    toggleCmdOpen] = useCollapse(true)
  const [fillMsg,    setFillMsg]    = useState('')

  function flash(msg) {
    setFillMsg(msg)
    setTimeout(() => setFillMsg(''), 6000)
  }

  function loadCmdQueue() { api.get('/api/hockey/vanger/cmd-queue').then(setCmdQueue).catch(() => {}) }

  const cmdOps = useQueueCmd({ onAdded: loadCmdQueue })

  function fillCmdQueue(type, maxAgeDays) {
    setCmdFilling(type)
    const body = { type }
    if (maxAgeDays !== undefined) body.max_age_days = maxAgeDays
    api.post('/api/hockey/vanger/cmd-queue/fill', body)
      .then(r => {
        loadCmdQueue()
        const c = r?.added ?? 0
        if (c > 0) {
          flash(`+${c} toegevoegd`)
        } else if (r?.stale_skip > 0) {
          flash(`${r.stale_skip} ploegen zitten in oud-seizoenpoules — gebruik eerst 'Clubs vullen' om nieuwe te ontdekken`)
        } else {
          flash('Niets toegevoegd (al in wachtrij of filter leeg)')
        }
      })
      .catch(() => {})
      .finally(() => setCmdFilling(null))
  }

  async function clearCmdQueue() {
    if (!await confirm('Alle pending cmds wissen?')) return
    api.delete('/api/hockey/vanger/cmd-queue').then(() => loadCmdQueue()).catch(() => {})
  }

  function retryCmdQueue(id) {
    api.post('/api/hockey/vanger/cmd-queue/' + id + '/retry', {}).then(() => loadCmdQueue()).catch(() => {})
  }

  function retryAllFailed() {
    const failed = cmdQueue?.recent?.filter(c => c.status === 'failed') || []
    if (!failed.length) return
    Promise.all(failed.map(c => api.post('/api/hockey/vanger/cmd-queue/' + c.id + '/retry', {})))
      .then(() => loadCmdQueue()).catch(() => {})
  }

  function clearDoneCmds() {
    api.delete('/api/hockey/vanger/cmd-queue?scope=done').then(() => loadCmdQueue()).catch(() => {})
  }

  useEffect(() => { loadCmdQueue() }, [])

  return {
    cmdQueue, cmdFilling, cmdOpen, toggleCmdOpen, fillMsg, flash, cmdOps,
    loadCmdQueue, fillCmdQueue, clearCmdQueue, retryCmdQueue, retryAllFailed, clearDoneCmds,
  }
}
