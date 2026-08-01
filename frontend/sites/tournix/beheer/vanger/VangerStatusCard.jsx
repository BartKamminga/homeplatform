export default function VangerStatusCard({ vangerStatus }) {
  if (!vangerStatus) return null
  const seenAt  = vangerStatus.last_seen ? new Date(vangerStatus.last_seen + 'Z') : null
  const ageSec  = seenAt ? Math.round((Date.now() - seenAt.getTime()) / 1000) : null
  const online  = ageSec !== null && ageSec < 60
  const running = vangerStatus.running && online
  const modeLabel = { poule_scan: '⚡ Poule scan', club_rescan: '🏢 Club-rescan', idle: '—' }

  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${running ? 'var(--color-success)' : 'var(--color-border)'}`, borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>{running ? '🟢' : online ? '🟡' : '⚫'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {running ? (modeLabel[vangerStatus.mode] || vangerStatus.mode) : online ? 'Vanger online · inactief' : 'Vanger offline'}
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
    </div>
  )
}
