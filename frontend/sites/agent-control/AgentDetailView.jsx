import { useEffect, useState } from 'react'
import { listAgents, toggleAgent } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'
import ContextsView from './ContextsView.jsx'
import TasksView from './TasksView.jsx'
import NotificationsView from './NotificationsView.jsx'
import LogView from './LogView.jsx'

// Sub-navigatie binnen 1 agent (item 951) - vervangt de losse globale
// Contexten/Opdrachten/Meldingen/Log-items in het linkermenu: eerst kies je
// een agent, dan pas de context/opdracht/melding/log daarbinnen.
const SUB_NAV = [
  { key: 'contexts', label: 'Contexten', View: ContextsView },
  { key: 'tasks', label: 'Opdrachten', View: TasksView },
  { key: 'notifications', label: 'Meldingen', View: NotificationsView },
  { key: 'log', label: 'Log', View: LogView },
]

export default function AgentDetailView({ agentKey, onBack, onError }) {
  const [agent, setAgent] = useState(null)
  const [sub, setSub] = useState('contexts')

  function refresh() {
    listAgents().then(items => setAgent(items.find(a => a.agent_key === agentKey))).catch(err => onError(err.message))
  }

  useEffect(refresh, [agentKey])

  function handleToggle() {
    toggleAgent(agentKey).then(refresh).catch(err => onError(err.message))
  }

  const Active = SUB_NAV.find(n => n.key === sub).View

  return (
    <div>
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack}>← Agents</button>
          <h2 style={s.h2}>{agent?.name || agentKey}</h2>
          {agent && <Badge label={agent.enabled ? 'Actief' : 'Uitgeschakeld'} variant={agent.enabled ? 'success' : 'neutral'} />}
        </div>
        {agent && (
          <button onClick={handleToggle}>{agent.enabled ? 'Uitschakelen' : 'Inschakelen'}</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '1px solid var(--color-border)' }}>
        {SUB_NAV.map(n => (
          <div
            key={n.key}
            onClick={() => setSub(n.key)}
            style={{
              padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              color: sub === n.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: sub === n.key ? 600 : 400,
              borderBottom: sub === n.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {n.label}
          </div>
        ))}
      </div>

      <Active onError={onError} lockedAgentKey={agentKey} />
    </div>
  )
}
