import { useEffect, useState } from 'react'
import { listAgents, getKnowledge, getRunLog } from './api.js'
import * as s from './styles.js'
import RunLogEntry from './RunLogEntry.jsx'

export default function LogView({ onError, lockedAgentKey }) {
  const [agents, setAgents] = useState(null)
  const [agentKey, setAgentKey] = useState(lockedAgentKey || '')
  const [knowledge, setKnowledge] = useState(null)
  const [log, setLog] = useState(null)
  // Ook binnen 1 agent kunnen meerdere contexten door elkaar lopen in de
  // runs-lijst - extra laag filtering bovenop de agent-filter (item 953).
  const [contextFilter, setContextFilter] = useState('')

  useEffect(() => {
    listAgents().then(items => {
      setAgents(items)
      if (!lockedAgentKey && items.length > 0) setAgentKey(items[0].agent_key)
    }).catch(err => onError(err.message))
  }, [])

  useEffect(() => {
    if (!agentKey) return
    setContextFilter('')
    getKnowledge(agentKey).then(setKnowledge).catch(() => {})
    getRunLog(agentKey).then(setLog).catch(() => {})
  }, [agentKey])

  const contextKeys = [...new Set((log || []).map(l => l.context_key).filter(Boolean))]
  const visibleLog = contextFilter ? (log || []).filter(l => l.context_key === contextFilter) : log

  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>Log</h2>
        {!lockedAgentKey && (
          <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
            {(agents || []).map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ ...s.panel, marginBottom: 16 }}>
        <div style={{ ...s.label, marginBottom: 8 }}>KENNIS (laatste run)</div>
        <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--color-surface-2)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12 }}>
          {knowledge?.notes || '(nog geen kennis opgebouwd)'}
        </pre>
      </div>

      <div style={s.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={s.label}>RUNS (input, output, afhandeling)</div>
          {contextKeys.length > 0 && (
            <select value={contextFilter} onChange={e => setContextFilter(e.target.value)} style={{ fontSize: 12 }}>
              <option value="">Alle contexten</option>
              {contextKeys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
        </div>
        {(visibleLog || []).map(entry => (
          <details key={entry.id} style={{ fontSize: 12, borderBottom: '1px solid var(--color-border)', padding: '6px 0' }}>
            <summary style={{ cursor: 'pointer' }}>
              {entry.created_at} — {entry.context_key || 'routine'}{entry.task_id && ` (taak ${entry.task_id})`}
            </summary>
            <RunLogEntry entry={entry} />
          </details>
        ))}
        {log && visibleLog.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nog geen runs.</p>}
      </div>
    </div>
  )
}
