import { useState } from 'react'
import * as s from './styles.js'
import AgentsView from './AgentsView.jsx'
import AgentDetailView from './AgentDetailView.jsx'

export default function App() {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [error, setError] = useState(null)

  function selectAgent(agentKey) {
    setSelectedAgent(agentKey)
    setError(null)
  }

  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={{ ...s.sidebarTitle, cursor: 'pointer' }} onClick={() => selectAgent(null)}>Agent Control</div>
        <div style={s.sidebarSub}>HomePlatform</div>
        <div style={s.navItem(!selectedAgent)} onClick={() => selectAgent(null)}>Agents</div>
      </div>
      <div style={s.main}>
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {selectedAgent
          ? <AgentDetailView agentKey={selectedAgent} onBack={() => selectAgent(null)} onError={setError} />
          : <AgentsView onError={setError} onSelect={selectAgent} />}
      </div>
    </div>
  )
}
