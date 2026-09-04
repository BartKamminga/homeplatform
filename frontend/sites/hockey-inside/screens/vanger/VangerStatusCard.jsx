import { useCollapse, Toggle } from '../ui.jsx'
import { useSettingsForm } from './hooks/useSettingsForm.jsx'
import ScanPlanPreview from './ScanPlanPreview.jsx'

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

// Instelbaar per client (item 706/707) — idle-timeout start op 20 min,
// navigatie-delay op 10-15s, hier op één plek bij te stellen i.p.v. lokaal
// per browser/container.
const FIELDS = [
  { key: 'idle_timeout_min', label: 'Idle-timeout (min)', width: 44 },
  { key: 'delay_min_sec',    label: 'Delay min (s)',       width: 40 },
  { key: 'delay_max_sec',    label: 'Delay max (s)',       width: 40 },
]

const VANGER_TUNING_KEYS = ['scout', 'ghost'].flatMap(client => FIELDS.map(f => `${client}_${f.key}`))

function VangerTuning({ settings, onSave }) {
  const { values, set, save } = useSettingsForm(settings, VANGER_TUNING_KEYS, onSave)

  if (!settings) return null

  const inputStyle = w => ({ width: w, fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-muted)' }}>
      {['scout', 'ghost'].map(client => (
        <div key={client} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 40, textTransform: 'capitalize' }}>{client}</span>
          {FIELDS.map(f => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {f.label}
              <input
                type="number" min="1" style={inputStyle(f.width)}
                value={values[`${client}_${f.key}`] ?? ''}
                onChange={e => set(`${client}_${f.key}`, e.target.value)}
              />
            </label>
          ))}
        </div>
      ))}
      <div>
        <button
          onClick={save}
          style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
        >
          Opslaan
        </button>
      </div>
    </div>
  )
}

// item 1084: het scan-plan-instellingenformulier + queue-filter + tijdlijn-
// preview zijn samengevoegd in ScanPlanPreview.jsx (mockup-layout: settings
// links, preview rechts, queue-invloed onder) - hier alleen nog de
// values/set/save doorgeven die VangerTab.jsx via useSettingsForm optilt.
export default function VangerStatusCard({ vangerStatus, onStartGhost, ghostBusy, onStartScout, scoutBusy, onToggleGhost, onToggleScanPlan, onToggleMatchday, vangerSettings, onSaveSettings, scanPlanForm }) {
  const [settingsOpen, toggleSettingsOpen] = useCollapse(false)
  if (!vangerStatus) return null
  const scout = vangerStatus.scout || {}
  const ghost = vangerStatus.ghost || {}
  const ghostEnabled = vangerStatus.ghost_enabled !== false
  const scanPlanEnabled = vangerStatus.scan_plan_enabled !== false
  const matchdayEnabled = vangerStatus.active_matchday_enabled !== false

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingBottom: 6 }}>
        <Toggle
          on={ghostEnabled} onChange={onToggleGhost} onVariant="muted" offVariant="partial"
          onLabel="● Ghost actief" offLabel="○ Ghost uit"
        />
        <Toggle
          on={scanPlanEnabled} onChange={onToggleScanPlan} onVariant="muted" offVariant="partial"
          onLabel="● Scan-plan actief" offLabel="○ Scan-plan uit"
          title="Zet de automatische scan-plan-pass (clublijst/club-cap + event-driven matchday-scan) volledig aan of uit"
        />
      </div>
      <div
        onClick={toggleSettingsOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', cursor: 'pointer', userSelect: 'none', borderTop: '1px solid var(--color-border)' }}
      >
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10 }}>{settingsOpen ? '▾' : '▸'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '.04em' }}>⚙ INSTELLINGEN</span>
      </div>
      {settingsOpen && (
        <>
          <VangerTuning settings={vangerSettings} onSave={onSaveSettings} />
          <ScanPlanPreview
            values={scanPlanForm.values} set={scanPlanForm.set} save={scanPlanForm.save}
            matchdayEnabled={matchdayEnabled} onToggleMatchday={onToggleMatchday}
          />
        </>
      )}
    </div>
  )
}
