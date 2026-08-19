// Twee client-types kunnen dezelfde cmd-queue bedienen, tegelijk:
//   Scout — de Chrome-extensie, handmatig vanaf een laptop (debug/kleine acties)
//   Ghost — de headless server-worker, op afstand getriggerd
// Beide krijgen hun eigen rij met dezelfde statuswoorden, want ze kunnen
// onafhankelijk van elkaar online/offline/actief zijn.
const STATE_LABEL = { online: 'Online', ingelogd: 'Ingelogd', wachten_op_queue: 'Wacht op queue' }
const MODE_LABEL = {
  poule_scan: '⚡ Poule scan', club_rescan: '🏢 Club-rescan',
  ghost_login: '👻 Inloggen...', ghost_run: '👻 Scant', ghost_login_failed: '👻 Login mislukt',
  nav_correct: '🧭 Tab corrigeren naar match-center',
  idle: null, polling: null,
}

function deriveDisplay(status, disabled) {
  const seenAt = status?.last_seen ? new Date(status.last_seen + 'Z') : null
  const ageSec = seenAt ? Math.round((Date.now() - seenAt.getTime()) / 1000) : null
  const online = ageSec !== null && ageSec < 60
  if (disabled) return { seenAt, ageSec, dot: '⚪', label: 'Uitgeschakeld', running: false }
  if (!online) return { seenAt, ageSec, dot: '⚫', label: 'Offline', running: false }
  const label = (status.running && MODE_LABEL[status.mode]) || STATE_LABEL[status.state] || 'Online'
  return { seenAt, ageSec, dot: status.running ? '🟢' : '🟡', label, running: status.running }
}

function ClientRow({ name, status, disabled, task, doneCount, onStart, startBusy, startTitle }) {
  const d = deriveDisplay(status, disabled)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 16 }}>{d.dot}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {name} · {d.label}
        </div>
        {d.running && task && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            → {task}
            {doneCount > 0 && <span style={{ marginLeft: 6 }}>({doneCount} gedaan)</span>}
          </div>
        )}
      </div>
      {d.seenAt && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {d.ageSec < 60 ? d.ageSec + 's geleden' : Math.round(d.ageSec / 60) + 'm geleden'}
        </span>
      )}
      {onStart && (
        <button
          onClick={onStart}
          disabled={startBusy || d.running || disabled || d.label === 'Offline'}
          title={startTitle}
          style={{
            fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
            color: 'var(--color-text)', cursor: (startBusy || d.running || disabled || d.label === 'Offline') ? 'default' : 'pointer',
            opacity: (startBusy || d.running || disabled || d.label === 'Offline') ? 0.5 : 1, whiteSpace: 'nowrap',
          }}
        >
          {startBusy ? 'Starten...' : '▶ Start'}
        </button>
      )}
    </div>
  )
}

export default function VangerStatusCard({ vangerStatus, onStartGhost, ghostBusy, onStartScout, scoutBusy, onToggleGhost }) {
  if (!vangerStatus) return null
  const scout = vangerStatus.scout || {}
  const ghost = vangerStatus.ghost || {}
  const ghostEnabled = vangerStatus.ghost_enabled !== false

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '4px 14px' }}>
      <ClientRow
        name="Scout" status={scout} task={scout.task} doneCount={scout.done_count}
        onStart={onStartScout} startBusy={scoutBusy}
        startTitle="Vraagt de Chrome-extensie om te starten (werkt alleen als Scout online is en het actieve tabblad op hockey.nl staat) — de Start Scout-knop in de extensie zelf blijft ook gewoon werken"
      />
      <div style={{ height: 1, background: 'var(--color-border)' }} />
      <ClientRow
        name="Ghost" status={ghost} disabled={!ghostEnabled} task={ghost.task} doneCount={ghost.done_count}
        onStart={onStartGhost} startBusy={ghostBusy}
        startTitle="Start de headless Ghost-worker op de server (verwerkt de queue zonder dat de Chrome-extensie open hoeft te staan)"
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 6 }}>
        <button
          onClick={onToggleGhost}
          style={{
            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-muted)', cursor: 'pointer',
          }}
        >
          {ghostEnabled ? 'Ghost uitschakelen' : 'Ghost weer aanzetten'}
        </button>
      </div>
    </div>
  )
}
