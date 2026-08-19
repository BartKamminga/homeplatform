// Twee client-types kunnen dezelfde cmd-queue bedienen:
//   Scout — de Chrome-extensie, handmatig vanaf een laptop (debug/kleine acties)
//   Ghost — de headless server-worker, op afstand getriggerd
const CLIENT_LABEL = { scout: 'Scout', ghost: 'Ghost' }

export default function VangerStatusCard({ vangerStatus, onStartGhost, ghostBusy }) {
  if (!vangerStatus) return null
  const seenAt  = vangerStatus.last_seen ? new Date(vangerStatus.last_seen + 'Z') : null
  const ageSec  = seenAt ? Math.round((Date.now() - seenAt.getTime()) / 1000) : null
  const online  = ageSec !== null && ageSec < 60
  const running = vangerStatus.running && online
  const client  = CLIENT_LABEL[vangerStatus.client] || null
  const modeLabel = { poule_scan: '⚡ Poule scan', club_rescan: '🏢 Club-rescan', ghost_login: '👻 Ghost logt in...', ghost_run: '👻 Ghost scant', ghost_login_failed: '👻 Ghost-login mislukt', idle: '—' }

  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${running ? 'var(--color-success)' : 'var(--color-border)'}`, borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>{running ? '🟢' : online ? '🟡' : '⚫'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {running ? (modeLabel[vangerStatus.mode] || vangerStatus.mode) : online ? `${client || 'Vanger'} online · inactief` : 'Vanger offline'}
        </div>
        {running && vangerStatus.task && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            → {vangerStatus.task}
            {vangerStatus.done_count > 0 && <span style={{ marginLeft: 6 }}>({vangerStatus.done_count} gedaan)</span>}
          </div>
        )}
      </div>
      {seenAt && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {ageSec < 60 ? ageSec + 's geleden' : Math.round(ageSec / 60) + 'm geleden'}
        </span>
      )}
      {!running && onStartGhost && (
        <button
          onClick={onStartGhost}
          disabled={ghostBusy}
          title="Start de headless Ghost-worker op de server (verwerkt de queue zonder dat de Chrome-extensie open hoeft te staan)"
          style={{
            fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
            color: 'var(--color-text)', cursor: ghostBusy ? 'default' : 'pointer',
            opacity: ghostBusy ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          👻 {ghostBusy ? 'Starten...' : 'Start Ghost'}
        </button>
      )}
    </div>
  )
}
