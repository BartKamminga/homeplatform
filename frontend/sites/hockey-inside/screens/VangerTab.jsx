import { useVangerState } from './vanger/useVangerState.js'
import VangerStatusCard  from './vanger/VangerStatusCard.jsx'
import CmdQueueSection   from './vanger/CmdQueueSection.jsx'
import QueueFilterBar    from './vanger/QueueFilterBar.jsx'
import PouleQueueSection from './vanger/PouleQueueSection.jsx'
import QueuesPanel       from './vanger/QueuesPanel.jsx'

export default function VangerTab() {
  const s = useVangerState()

  const clubLogoMap = Object.fromEntries(
    s.clubs.filter(c => c.logo_url).map(c => [c.external_id, c.logo_url])
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {s.error   && <p style={{ color: 'var(--color-danger)',     fontSize: 12 }}>{s.error}</p>}
      {s.loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      <VangerStatusCard
        vangerStatus={s.vangerStatus}
        onStartGhost={s.triggerGhost} ghostBusy={s.ghostBusy}
        onStartScout={s.triggerScout} scoutBusy={s.scoutBusy}
        onToggleGhost={s.toggleGhostEnabled}
        onToggleScanPlan={s.toggleScanPlanEnabled}
        vangerSettings={s.vangerSettings} onSaveSettings={s.saveVangerSettings}
      />

      {/* item 543: contextbadge when no clubs have been scanned yet */}
      {!s.loading && s.clubs.length === 0 && (
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
        cmdQueue={s.cmdQueue} cmdFilling={s.cmdFilling} fillMsg={s.fillMsg}
        gapData={s.gapData}
        cmdOpen={s.cmdOpen} setCmdOpen={s.setCmdOpen}
        onFill={s.fillCmdQueue} onClear={s.clearCmdQueue}
        onRetryAll={s.retryAllFailed} onClearDone={s.clearDoneCmds}
        onGapRefresh={s.loadGapAnalysis}
        onRetrySingle={s.retryCmdQueue}
        cmdOps={s.cmdOps}
        smartScan={s.smartScan} smartBusy={s.smartBusy}
        onStartSmartScan={s.startSmartScan} onStopSmartScan={s.stopSmartScan}
      />

      <QueuesPanel
        pluginErrors={s.pluginErrors} setPluginErrors={s.setPluginErrors}
        clubScanQueue={s.clubScanQueue} clubLogoMap={clubLogoMap}
        competitions={s.competitions}
        rangeData={s.rangeData} inferResult={s.inferResult} isInferring={s.isInferring}
        expanded={s.expanded} errOpen={s.errOpen} setErrOpen={s.setErrOpen}
        toggle={s.toggle} onRunInfer={s.runInfer}
        cmdOps={s.cmdOps}
      />

      <QueueFilterBar
        qFilter={s.qFilter} queue={s.queue} clubs={s.clubs} showWaiting={s.showWaiting}
        onToggleNiveau={s.toggleNiveau} onToggleGender={s.toggleGender}
        onToggleHt={s.toggleHt} onToggleAge={s.toggleAge}
        onSaveFilter={s.saveFilter} onSetShowWaiting={s.setShowWaiting}
      />

      {s.queue.total > 0 && (
        <PouleQueueSection
          queue={s.queue} qFilter={s.qFilter} allTeams={s.allTeams}
          showWaiting={s.showWaiting} expanded={s.expanded}
          queueOpen={s.queueOpen} setQueueOpen={s.setQueueOpen}
          toggle={s.toggle} onResetPoule={s.resetPoule}
          cmdOps={s.cmdOps}
          onFillClubs={() => s.fillCmdQueue('clubs')}
          clubsFilling={s.cmdFilling === 'clubs'}
        />
      )}

      {!s.loading && s.queue.total === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Geen poule queue — teams worden geladen zodra de vanger clubs heeft gescand
        </div>
      )}
    </div>
  )
}
