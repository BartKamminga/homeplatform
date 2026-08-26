import { useEffect, useState } from 'react'
import { listAgents, toggleAgent } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'

// item 962: er is geen echte per-agent schedule (zie backend-notitie in
// agent_control.list_agents) - dit is een schatting: laatste heartbeat +
// het bekende poll-interval, geen harde garantie.
function nextRunLabel(a) {
  if (!a.status?.last_seen || !a.poll_interval_sec) return null
  const lastSeenMs = new Date(a.status.last_seen + 'Z').getTime()
  const diffSec = Math.round((lastSeenMs + a.poll_interval_sec * 1000 - Date.now()) / 1000)
  if (diffSec <= 0) return 'binnenkort'
  if (diffSec < 60) return `over ${diffSec}s`
  return `over ${Math.round(diffSec / 60)} min`
}

export default function AgentsView({ onError, onSelect }) {
  const [agents, setAgents] = useState(null)

  function refresh() {
    listAgents().then(setAgents).catch(err => onError(err.message))
  }

  useEffect(refresh, [])

  function handleToggle(agentKey, ev) {
    ev.stopPropagation()
    toggleAgent(agentKey).then(refresh).catch(err => onError(err.message))
  }

  return (
    <div>
      <div style={s.topbar}><h2 style={s.h2}>Agents</h2></div>
      {!agents && <p>Laden...</p>}
      {agents && agents.length === 0 && <p>Nog geen agents geregistreerd.</p>}
      <div style={s.grid}>
        {agents && agents.map(a => {
          const online = a.status?.last_seen && (Date.now() - new Date(a.status.last_seen + 'Z').getTime()) < 60_000
          const nextRun = nextRunLabel(a)
          return (
            <div key={a.agent_key} style={s.card} onClick={() => onSelect(a.agent_key)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span>{online ? (a.status?.running ? '🟢' : '🟡') : '⚫'}</span>
                <strong style={{ flex: 1 }}>{a.name}</strong>
              </div>
              <Badge label={a.enabled ? 'Actief' : 'Uitgeschakeld'} variant={a.enabled ? 'success' : 'neutral'} />
              {a.status?.task && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>→ {a.status.task}</div>}
              {a.pending_tasks_count > 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  📋 {a.pending_tasks_count} opdracht{a.pending_tasks_count === 1 ? '' : 'en'} wachtend
                </div>
              )}
              {a.enabled && nextRun && (
                <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginTop: 4 }}>
                  ⏱ volgende run: {nextRun}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button onClick={ev => handleToggle(a.agent_key, ev)}>
                  {a.enabled ? 'Uitschakelen' : 'Inschakelen'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
