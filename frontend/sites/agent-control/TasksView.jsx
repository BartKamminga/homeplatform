import { useEffect, useState } from 'react'
import { listAgents, listContexts, listTasks, addTask, getAgentRegistry, getRunLog } from './api.js'
import * as s from './styles.js'
import RunLogEntry from './RunLogEntry.jsx'

export default function TasksView({ onError, lockedAgentKey }) {
  const [agents, setAgents] = useState(null)
  const [agentKey, setAgentKey] = useState(lockedAgentKey || '')
  const [registry, setRegistry] = useState(null)
  const [contexts, setContexts] = useState([])
  const [tasks, setTasks] = useState(null)
  const [logs, setLogs] = useState([])
  const [instruction, setInstruction] = useState('')
  const [contextKey, setContextKey] = useState('')
  const [paramValues, setParamValues] = useState({})
  const [paramsText, setParamsText] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    listAgents().then(items => {
      setAgents(items)
      if (!lockedAgentKey && items.length > 0) setAgentKey(items[0].agent_key)
    }).catch(err => onError(err.message))
  }, [])

  function refresh(key) {
    listTasks(key).then(setTasks).catch(err => onError(err.message))
    getRunLog(key).then(setLogs).catch(() => {})
  }

  useEffect(() => {
    if (!agentKey) return
    refresh(agentKey)
    listContexts(agentKey).then(setContexts).catch(() => {})
    getAgentRegistry(agentKey).then(setRegistry).catch(() => {})
  }, [agentKey])

  useEffect(() => { setParamValues({}) }, [contextKey])

  const selectedContext = contexts.find(c => c.key === contextKey)
  const dataSourceParams = registry?.data_sources?.[selectedContext?.data_source_key]?.params || []

  function handleAdd() {
    if (!instruction) return
    let params = {}
    if (dataSourceParams.length > 0) {
      params = Object.fromEntries(
        dataSourceParams
          .filter(p => paramValues[p.name])
          .map(p => [p.name, paramValues[p.name]])
      )
    } else if (paramsText) {
      try { params = JSON.parse(paramsText) } catch { onError('Params is geen geldige JSON'); return }
    }
    addTask(agentKey, instruction, contextKey, params).then(() => {
      setInstruction(''); setContextKey(''); setParamValues({}); setParamsText('')
      refresh(agentKey)
    }).catch(err => onError(err.message))
  }

  return (
    <div>
      <div style={s.topbar}><h2 style={s.h2}>Opdrachten</h2></div>
      <div style={s.panel}>
        {!lockedAgentKey && (
          <div style={s.field}>
            <label style={s.label}>Agent</label>
            <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
              {(agents || []).map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
            </select>
          </div>
        )}
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

        {dataSourceParams.length > 0 ? (
          <div style={s.field}>
            <label style={s.label}>Params (databron: {registry.data_sources[selectedContext.data_source_key].label})</label>
            {dataSourceParams.map(p => (
              <div key={p.name} style={{ marginBottom: 6 }}>
                <input
                  value={paramValues[p.name] || ''}
                  onChange={e => setParamValues({ ...paramValues, [p.name]: e.target.value })}
                  placeholder={`${p.name}${p.required ? ' *' : ''} (${p.type}) — ${p.desc || ''}`}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={s.field}>
            <label style={s.label}>Params (JSON, optioneel)</label>
            <input value={paramsText} onChange={e => setParamsText(e.target.value)} placeholder='bv. {"link_id": "..."}' />
          </div>
        )}
        <button onClick={handleAdd}>Toevoegen</button>

        <div style={{ marginTop: 24 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>GESCHIEDENIS</div>
          {(tasks || []).map(t => {
            const taskLogs = logs.filter(l => l.task_id === t.id)
            const isOpen = expanded === t.id
            return (
              <div key={t.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div
                  style={{ cursor: taskLogs.length > 0 ? 'pointer' : 'default' }}
                  onClick={() => taskLogs.length > 0 && setExpanded(isOpen ? null : t.id)}
                >
                  [{t.status}] {t.context_key && <span style={s.code}>{t.context_key}</span>} {t.instruction}
                  {taskLogs.length > 0 && <span style={{ color: 'var(--color-text-light)' }}> {isOpen ? '▲' : '▼'} berichten ({taskLogs.length})</span>}
                </div>
                {isOpen && taskLogs.map(entry => <RunLogEntry key={entry.id} entry={entry} />)}
              </div>
            )
          })}
          {tasks && tasks.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Nog geen opdrachten.</p>}
        </div>
      </div>
    </div>
  )
}
