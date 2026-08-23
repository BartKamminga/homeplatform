import { useEffect, useState } from 'react'
import { listAgents, toggleAgent, listContexts, listNotifications, markNotificationRead, listTasks, addTask, getKnowledge, getRunLog } from './api.js'

function KnowledgeAndLog({ agentKey }) {
  const [open, setOpen] = useState(false)
  const [knowledge, setKnowledge] = useState(null)
  const [log, setLog] = useState(null)

  function load() {
    getKnowledge(agentKey).then(setKnowledge).catch(() => {})
    getRunLog(agentKey).then(setLog).catch(() => {})
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => { setOpen(!open); if (!open) load() }} style={{ fontSize: 11 }}>
        {open ? 'Kennis & log verbergen' : 'Kennis & log tonen'}
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>KENNIS (laatste run)</div>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
            {knowledge?.notes || '(nog geen kennis opgebouwd)'}
          </pre>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginTop: 8 }}>LOG (recentste runs — input, output, afhandeling)</div>
          {(log || []).map(entry => (
            <details key={entry.id} style={{ fontSize: 11, borderBottom: '1px solid #eee', padding: '4px 0' }}>
              <summary style={{ cursor: 'pointer' }}>
                {entry.created_at} — {entry.context_key || 'routine'}
                {entry.task_id && ` (taak ${entry.task_id})`}
              </summary>
              <div style={{ marginTop: 4 }}>
                <div style={{ fontWeight: 600 }}>Reasoning</div>
                <div>{entry.reasoning}</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>Input (context naar Claude)</div>
                <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 6, borderRadius: 4 }}>
                  {JSON.stringify(entry.input_payload, null, 2)}
                </pre>
                <div style={{ fontWeight: 600, marginTop: 4 }}>Afhandeling (post-processing)</div>
                <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 6, borderRadius: 4 }}>
                  {JSON.stringify(entry.post_process_result, null, 2)}
                </pre>
              </div>
            </details>
          ))}
          {log && log.length === 0 && <p style={{ fontSize: 11, color: '#888' }}>Nog geen runs.</p>}
        </div>
      )}
    </div>
  )
}

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

function AgentRow({ agent, contexts, onToggle, tasks, draft, onDraftChange, onAddTask }) {
  const status = agent.status
  const online = status?.last_seen && (Date.now() - new Date(status.last_seen + 'Z').getTime()) < 60_000
  const d = draft || { instruction: '', contextKey: '', params: '' }
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
            [{t.status}] {t.context_key ? `(${t.context_key}) ` : ''}{t.instruction}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={d.contextKey}
              onChange={e => onDraftChange(agent.agent_key, { ...d, contextKey: e.target.value })}
              style={{ fontSize: 12 }}
            >
              <option value="">(geen context / routine)</option>
              {(contexts || []).map(c => (
                <option key={c.key} value={c.key}>{c.name}</option>
              ))}
            </select>
            <input
              value={d.instruction}
              onChange={e => onDraftChange(agent.agent_key, { ...d, instruction: e.target.value })}
              placeholder="Ad-hoc instructie..."
              style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
            />
          </div>
          <input
            value={d.params}
            onChange={e => onDraftChange(agent.agent_key, { ...d, params: e.target.value })}
            placeholder='Params als JSON (optioneel), bv. {"link_id": "..."}'
            style={{ fontSize: 12, padding: '4px 6px' }}
          />
          <button onClick={() => onAddTask(agent.agent_key)} style={{ alignSelf: 'flex-start' }}>Toevoegen</button>
        </div>
      </div>

      <KnowledgeAndLog agentKey={agent.agent_key} />
    </div>
  )
}

export default function App() {
  const [agents, setAgents] = useState(null)
  const [contextsByAgent, setContextsByAgent] = useState({})
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
      listContexts(a.agent_key).then(items => {
        setContextsByAgent(prev => ({ ...prev, [a.agent_key]: items }))
      }).catch(() => {})
    })
  }, [agents])

  function handleToggle(agentKey) {
    toggleAgent(agentKey).then(refreshAgents).catch(err => setError(err.message))
  }

  function handleAddTask(agentKey) {
    const d = draftByAgent[agentKey] || {}
    if (!d.instruction) return
    let params = {}
    if (d.params) {
      try {
        params = JSON.parse(d.params)
      } catch {
        setError('Params is geen geldige JSON')
        return
      }
    }
    addTask(agentKey, d.instruction, d.contextKey, params).then(() => {
      setDraftByAgent(prev => ({ ...prev, [agentKey]: { instruction: '', contextKey: '', params: '' } }))
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
          contexts={contextsByAgent[a.agent_key]}
          onToggle={handleToggle}
          tasks={tasksByAgent[a.agent_key]}
          draft={draftByAgent[a.agent_key]}
          onDraftChange={(key, val) => setDraftByAgent(prev => ({ ...prev, [key]: val }))}
          onAddTask={handleAddTask}
        />
      ))}
    </div>
  )
}
