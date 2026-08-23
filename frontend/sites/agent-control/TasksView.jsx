import { useEffect, useState } from 'react'
import { listAgents, listContexts, listTasks, addTask } from './api.js'
import * as s from './styles.js'

export default function TasksView({ onError }) {
  const [agents, setAgents] = useState(null)
  const [agentKey, setAgentKey] = useState('')
  const [contexts, setContexts] = useState([])
  const [tasks, setTasks] = useState(null)
  const [instruction, setInstruction] = useState('')
  const [contextKey, setContextKey] = useState('')
  const [paramsText, setParamsText] = useState('')

  useEffect(() => {
    listAgents().then(items => {
      setAgents(items)
      if (items.length > 0) setAgentKey(items[0].agent_key)
    }).catch(err => onError(err.message))
  }, [])

  function refreshTasks(key) {
    listTasks(key).then(setTasks).catch(err => onError(err.message))
  }

  useEffect(() => {
    if (!agentKey) return
    refreshTasks(agentKey)
    listContexts(agentKey).then(setContexts).catch(() => {})
  }, [agentKey])

  function handleAdd() {
    if (!instruction) return
    let params = {}
    if (paramsText) {
      try { params = JSON.parse(paramsText) } catch { onError('Params is geen geldige JSON'); return }
    }
    addTask(agentKey, instruction, contextKey, params).then(() => {
      setInstruction(''); setContextKey(''); setParamsText('')
      refreshTasks(agentKey)
    }).catch(err => onError(err.message))
  }

  return (
    <div>
      <div style={s.topbar}><h2 style={s.h2}>Opdrachten</h2></div>
      <div style={s.panel}>
        <div style={s.field}>
          <label style={s.label}>Agent</label>
          <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
            {(agents || []).map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Context</label>
          <select value={contextKey} onChange={e => setContextKey(e.target.value)}>
            <option value="">(geen context / routine)</option>
            {contexts.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Instructie</label>
          <input value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="Ad-hoc instructie..." />
        </div>
        <div style={s.field}>
          <label style={s.label}>Params (JSON, optioneel)</label>
          <input value={paramsText} onChange={e => setParamsText(e.target.value)} placeholder='bv. {"link_id": "..."}' />
        </div>
        <button onClick={handleAdd}>Toevoegen</button>

        <div style={{ marginTop: 24 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>GESCHIEDENIS</div>
          {(tasks || []).map(t => (
            <div key={t.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
              [{t.status}] {t.context_key && <span style={s.code}>{t.context_key}</span>} {t.instruction}
            </div>
          ))}
          {tasks && tasks.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Nog geen opdrachten.</p>}
        </div>
      </div>
    </div>
  )
}
