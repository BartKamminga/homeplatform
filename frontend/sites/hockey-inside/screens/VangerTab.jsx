import { useEffect } from 'react'
import { useConfirm, useCollapse } from './ui.jsx'
import { useDiscoveryData }  from './vanger/hooks/useDiscoveryData.jsx'
import { usePluginErrors }   from './vanger/hooks/usePluginErrors.jsx'
import { useCmdQueue }       from './vanger/hooks/useCmdQueue.jsx'
import { useSmartScan }      from './vanger/hooks/useSmartScan.jsx'
import { useVangerStatus }   from './vanger/hooks/useVangerStatus.jsx'
import { useQueueFilter }    from './vanger/hooks/useQueueFilter.jsx'
import { useVangerSettings } from './vanger/hooks/useVangerSettings.jsx'
import { useSettingsForm } from './vanger/hooks/useSettingsForm.jsx'
import VangerStatusCard, { SCAN_PLAN_KEYS, NOTIFY_KEY } from './vanger/VangerStatusCard.jsx'
import CmdQueueSection   from './vanger/CmdQueueSection.jsx'
import QueueFilterBar    from './vanger/QueueFilterBar.jsx'
import QueueRulesInfo    from './vanger/QueueRulesInfo.jsx'
import QueuesPanel       from './vanger/QueuesPanel.jsx'
import NotificationSubscribeToggle from '@components/NotificationSubscribeToggle.jsx'

export default function VangerTab() {
  const [errOpen, toggleErrOpen] = useCollapse(false)
  const [confirm, confirmDialog] = useConfirm()

  const discovery      = useDiscoveryData()
  const pluginErrors   = usePluginErrors()
  const cmdQueue       = useCmdQueue(confirm)
  const smartScan      = useSmartScan(cmdQueue.flash, cmdQueue.loadCmdQueue)
  const vangerStatus   = useVangerStatus(cmdQueue.flash)
  const queueFilter    = useQueueFilter(discovery.setQueue)
  const vangerSettings = useVangerSettings(cmdQueue.flash)
  // item 1084: opgetild uit VangerStatusCard.jsx/ScanPlanTuning zodat de
  // scan-plan-preview dezelfde, nog-niet-opgeslagen instellingswaarden kan
  // meelezen terwijl je typt (zie ScanPlanTuning's docstring-commentaar).
  const scanPlanForm = useSettingsForm(vangerSettings.vangerSettings, [...SCAN_PLAN_KEYS, NOTIFY_KEY], vangerSettings.saveVangerSettings, [NOTIFY_KEY])

  // Gedeelde 8s-poll voor live status tijdens een achtergrond-scan (Ghost/Scout
  // kunnen buiten deze pagina om draaien) - één gezamenlijke interval i.p.v. 3
  // losse, zodat dit exact hetzelfde gedrag geeft als vóór de hook-opsplitsing.
  useEffect(() => {
    function poll() {
      vangerStatus.loadVangerStatus()
      cmdQueue.loadCmdQueue()
      smartScan.loadSmartScan()
    }
    poll()
    const t = setInterval(poll, 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {discovery.error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{discovery.error}</p>}
      {discovery.loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <NotificationSubscribeToggle site="hockey-inside" />
      </div>

      <VangerStatusCard
        vangerStatus={vangerStatus.vangerStatus}
        onStartGhost={vangerStatus.triggerGhost} ghostBusy={vangerStatus.ghostBusy}
        onStartScout={vangerStatus.triggerScout} scoutBusy={vangerStatus.scoutBusy}
        onToggleGhost={vangerStatus.toggleGhostEnabled}
        onToggleScanPlan={vangerStatus.toggleScanPlanEnabled}
        onToggleMatchday={vangerStatus.toggleActiveMatchdayEnabled}
        vangerSettings={vangerSettings.vangerSettings} onSaveSettings={vangerSettings.saveVangerSettings}
        scanPlanForm={scanPlanForm}
      />

      {/* item 543: contextbadge when no clubs have been scanned yet */}
      {!discovery.loading && discovery.clubs.length === 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: 'color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))',
          border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
          color: 'var(--color-warning)',
        }}>
          Geen clubs gevonden. Klik <strong>1. Clubs vullen</strong> om te beginnen — clubs zijn nodig voordat poules gevuld kunnen worden.
        </div>
      )}

      <CmdQueueSection
        cmdQueue={cmdQueue.cmdQueue} cmdFilling={cmdQueue.cmdFilling} fillMsg={cmdQueue.fillMsg}
        cmdOpen={cmdQueue.cmdOpen} setCmdOpen={cmdQueue.toggleCmdOpen}
        onFill={cmdQueue.fillCmdQueue} onClear={cmdQueue.clearCmdQueue}
        onRetryAll={cmdQueue.retryAllFailed} onClearDone={cmdQueue.clearDoneCmds}
        onRetrySingle={cmdQueue.retryCmdQueue}
        cmdOps={cmdQueue.cmdOps}
        smartScan={smartScan.smartScan} smartBusy={smartScan.smartBusy}
        onStartSmartScan={smartScan.startSmartScan} onStopSmartScan={smartScan.stopSmartScan}
      />

      <QueuesPanel
        pluginErrors={pluginErrors.pluginErrors} setPluginErrors={pluginErrors.setPluginErrors}
        errOpen={errOpen} setErrOpen={toggleErrOpen}
      />

      <QueueRulesInfo />

      <QueueFilterBar
        qFilter={queueFilter.qFilter} queue={discovery.queue} clubs={discovery.clubs} showWaiting={queueFilter.showWaiting}
        onToggleNiveau={queueFilter.toggleNiveau} onToggleGender={queueFilter.toggleGender}
        onToggleHt={queueFilter.toggleHt} onToggleAge={queueFilter.toggleAge}
        onSaveFilter={queueFilter.saveFilter} onSetShowWaiting={queueFilter.setShowWaiting}
      />

      {confirmDialog}
    </div>
  )
}
