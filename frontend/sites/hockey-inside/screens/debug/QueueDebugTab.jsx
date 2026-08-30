import { useState } from 'react'
import ScheduleDebugPanel from './ScheduleDebugPanel.jsx'
import VangerQueueDebugPanel from './VangerQueueDebugPanel.jsx'

// Debug-tab (admin-only) met twee losse, puur lezende bronnen die niet met
// elkaar verward mogen worden: het SCANSCHEMA (ScanScheduleEntry - de vooraf
// berekende planning, Fase A schaduw-modus) en de echte uitvoeringsqueue
// (VangerCmd - wat Ghost/Scout daadwerkelijk afwerkt). Scanschema is de
// default sub-tab (dat is waar de meeste debug-vragen over gaan).
export default function QueueDebugTab() {
  const [view, setView] = useState('schedule')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['schedule', 'Scanschema'], ['queue', 'Vanger-queue']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: '5px 12px', fontSize: 12, fontWeight: view === key ? 600 : 400,
              borderRadius: 6, cursor: 'pointer', border: '1px solid var(--color-border)',
              background: view === key ? 'var(--color-primary)' : 'var(--color-surface)',
              color: view === key ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'schedule' && <ScheduleDebugPanel />}
      {view === 'queue' && <VangerQueueDebugPanel />}
    </div>
  )
}
