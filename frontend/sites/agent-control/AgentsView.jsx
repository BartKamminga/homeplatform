import { useEffect, useState } from 'react'
import { listAgents, toggleAgent } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'

export default function AgentsView({ onError }) {
  const [agents, setAgents] = useState(null)

  function refresh() {
    listAgents().then(setAgents).catch(err => onError(err.message))
  }

  useEffect(refresh, [])

  function handleToggle(agentKey) {
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
          return (
            <div key={a.agent_key} style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span>{online ? (a.status?.running ? '🟢' : '🟡') : '⚫'}</span>
                <strong style={{ flex: 1 }}>{a.name}</strong>
              </div>
              <Badge label={a.enabled ? 'Actief' : 'Uitgeschakeld'} variant={a.enabled ? 'success' : 'neutral'} />
              {a.status?.task && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>→ {a.status.task}</div>}
              <div style={{ marginTop: 12 }}>
                <button onClick={() => handleToggle(a.agent_key)}>
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
