import { useEffect, useState } from 'react'
import { listAgents, toggleAgent, listNotifications, markNotificationRead, listTasks, addTask } from './api.js'

function NotificationsPanel({ notifications, onRead }) {
  if (!notifications) return null
  return (
    <div style={{ marginBottom: 24, border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>
        Meldingen {notifications.unread_count > 0 && `(${notifications.unread_count} ongelezen)`}
      </h2>
      {notifications.items.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>Geen meldingen.</p>}
      {notifications.items.map(n => (
        <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '4px 0', opacity: n.read_at ? 0.5 : 1 }}>
          <span>[{n.agent_key}] {n.message}</span>
          {!n.read_at && <button onClick={() => onRead(n.id)} style={{ fontSize: 11 }}>gelezen</button>}
        </div>
      ))}
    </div>
  )
}

function AgentRow({ agent, onToggle, tasks, newInstruction, onInstructionChange, onAddTask }) {
  const status = agent.status
  const online = status?.last_seen && (Date.now() - new Date(status.last_seen + 'Z').getTime()) < 60_000
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{online ? (status?.running ? '🟢' : '🟡') : '⚫'}</span>
        <strong style={{ flex: 1 }}>{agent.name}</strong>
        <button onClick={() => onToggle(agent.agent_key)}>
          {agent.enabled ? '● Actief' : '○ Uitgeschakeld'}
        </button>
      </div>
      {status?.task && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>→ {status.task}</div>}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 }}>OPDRACHTEN</div>
        {(tasks || []).map(t => (
          <div key={t.id} style={{ fontSize: 12, padding: '2px 0' }}>
            [{t.status}] {t.instruction}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <input
            value={newInstruction || ''}
            onChange={e => onInstructionChange(agent.agent_key, e.target.value)}
            placeholder="Ad-hoc instructie..."
            style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
          />
          <button onClick={() => onAddTask(agent.agent_key)}>Toevoegen</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [agents, setAgents] = useState(null)
  const [notifications, setNotifications] = useState(null)
  const [tasksByAgent, setTasksByAgent] = useState({})
  const [draftByAgent, setDraftByAgent] = useState({})
  const [error, setError] = useState(null)

  function refreshAgents() {
    listAgents().then(setAgents).catch(err => setError(err.message))
  }

  function refreshNotifications() {
    listNotifications().then(setNotifications).catch(err => setError(err.message))
  }

  useEffect(() => {
    refreshAgents()
    refreshNotifications()
  }, [])

  useEffect(() => {
    if (!agents) return
    agents.forEach(a => {
      listTasks(a.agent_key).then(items => {
        setTasksByAgent(prev => ({ ...prev, [a.agent_key]: items }))
      }).catch(() => {})
    })
  }, [agents])

  function handleToggle(agentKey) {
    toggleAgent(agentKey).then(refreshAgents).catch(err => setError(err.message))
  }

  function handleAddTask(agentKey) {
    const instruction = draftByAgent[agentKey]
    if (!instruction) return
    addTask(agentKey, instruction).then(() => {
      setDraftByAgent(prev => ({ ...prev, [agentKey]: '' }))
      listTasks(agentKey).then(items => setTasksByAgent(prev => ({ ...prev, [agentKey]: items })))
    }).catch(err => setError(err.message))
  }

  function handleRead(id) {
    markNotificationRead(id).then(refreshNotifications).catch(err => setError(err.message))
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}>Agent Control</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <NotificationsPanel notifications={notifications} onRead={handleRead} />

      {!agents && <p>Laden...</p>}
      {agents && agents.length === 0 && <p>Nog geen agents geregistreerd.</p>}
      {agents && agents.map(a => (
        <AgentRow
          key={a.agent_key}
          agent={a}
          onToggle={handleToggle}
          tasks={tasksByAgent[a.agent_key]}
          newInstruction={draftByAgent[a.agent_key]}
          onInstructionChange={(key, val) => setDraftByAgent(prev => ({ ...prev, [key]: val }))}
          onAddTask={handleAddTask}
        />
      ))}
    </div>
  )
}
