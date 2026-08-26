import { useEffect, useState } from 'react'
import { listAgents, getKnowledge, getRunLog } from './api.js'
import * as s from './styles.js'
import RunLogEntry from './RunLogEntry.jsx'

export default function LogView({ onError }) {
  const [agents, setAgents] = useState(null)
  const [agentKey, setAgentKey] = useState('')
  const [knowledge, setKnowledge] = useState(null)
  const [log, setLog] = useState(null)

  useEffect(() => {
    listAgents().then(items => {
      setAgents(items)
      if (items.length > 0) setAgentKey(items[0].agent_key)
    }).catch(err => onError(err.message))
  }, [])

  useEffect(() => {
    if (!agentKey) return
    getKnowledge(agentKey).then(setKnowledge).catch(() => {})
    getRunLog(agentKey).then(setLog).catch(() => {})
  }, [agentKey])

  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>Log</h2>
        <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
          {(agents || []).map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
        </select>
      </div>

      <div style={{ ...s.panel, marginBottom: 16 }}>
        <div style={{ ...s.label, marginBottom: 8 }}>KENNIS (laatste run)</div>
        <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--color-surface-2)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12 }}>
          {knowledge?.notes || '(nog geen kennis opgebouwd)'}
        </pre>
      </div>

      <div style={s.panel}>
        <div style={{ ...s.label, marginBottom: 8 }}>RUNS (input, output, afhandeling)</div>
        {(log || []).map(entry => (
          <details key={entry.id} style={{ fontSize: 12, borderBottom: '1px solid var(--color-border)', padding: '6px 0' }}>
            <summary style={{ cursor: 'pointer' }}>
              {entry.created_at} — {entry.context_key || 'routine'}{entry.task_id && ` (taak ${entry.task_id})`}
            </summary>
            <RunLogEntry entry={entry} />
          </details>
        ))}
        {log && log.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nog geen runs.</p>}
      </div>
    </div>
  )
}
