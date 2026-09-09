import { useState } from 'react'
import * as s from './styles.js'
import AgentsView from './AgentsView.jsx'
import AgentDetailView from './AgentDetailView.jsx'
import DevSessionsView from './DevSessionsView.jsx'

const TABS = [
  { key: 'agents', label: 'Agents' },
  { key: 'dev-sessions', label: 'Dev sessions' },
]

export default function App() {
  const [tab, setTab] = useState('agents')
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [error, setError] = useState(null)

  function selectAgent(agentKey) {
    setSelectedAgent(agentKey)
    setError(null)
  }

  function selectTab(key) {
    setTab(key)
    setSelectedAgent(null)
    setError(null)
  }

  return (
    <div style={s.shell}>
      <div style={s.header}>
        <span style={s.headerTitle} onClick={() => selectTab('agents')}>Agent Control</span>
        <span style={s.headerSub}>HomePlatform</span>
        <div style={{ display: 'flex', gap: 14, marginLeft: 'auto' }}>
          {TABS.map(t => (
            <span
              key={t.key}
              onClick={() => selectTab(t.key)}
              style={{
                cursor: 'pointer', fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div style={s.main}>
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {tab === 'agents' && (
          selectedAgent
            ? <AgentDetailView agentKey={selectedAgent} onBack={() => selectAgent(null)} onError={setError} />
            : <AgentsView onError={setError} onSelect={selectAgent} />
        )}
        {tab === 'dev-sessions' && <DevSessionsView onError={setError} />}
      </div>
    </div>
  )
}
