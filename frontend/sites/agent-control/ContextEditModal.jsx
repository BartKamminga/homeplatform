import { useEffect, useState } from 'react'
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx'
import { listAgents, updateContext } from './api.js'
import * as s from './styles.js'

export default function ContextEditModal({ ctx, actions, onClose, onSaved, onError }) {
  const [agents, setAgents] = useState([])
  const [name, setName] = useState(ctx.name)
  const [agentKey, setAgentKey] = useState(ctx.agent_key)
  const [preRunInfo, setPreRunInfo] = useState(ctx.pre_run_info)
  const [actionKey, setActionKey] = useState(ctx.post_process_action)
  const [saving, setSaving] = useState(false)

  useEffect(() => { listAgents().then(setAgents) }, [])

  function handleSave() {
    setSaving(true)
    updateContext(ctx.key, { agent_key: agentKey, name, pre_run_info: preRunInfo, post_process_action: actionKey })
      .then(() => onSaved())
      .catch(err => { onError(err.message); setSaving(false) })
  }

  return (
    <Modal title={`Bewerken: ${ctx.key}`} onClose={onClose} width={680}>
      <div style={s.field}>
        <label style={s.label}>Naam</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div style={s.field}>
        <label style={s.label}>Agent</label>
        <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
          {agents.map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
        </select>
      </div>
      <div style={s.field}>
        <label style={s.label}>Pre-run info</label>
        <textarea value={preRunInfo} onChange={e => setPreRunInfo(e.target.value)} rows={6} />
      </div>
      <div style={s.field}>
        <label style={s.label}>Post-processing-actie</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {Object.entries(actions).map(([k, a]) => (
            <div
              key={k}
              onClick={() => setActionKey(k)}
              style={{
                border: `1.5px solid ${actionKey === k ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: actionKey === k ? 'var(--color-primary-light)' : 'transparent',
                borderRadius: 'var(--radius-md)', padding: 10, cursor: 'pointer', fontSize: 12,
              }}
            >
              {a.label}
            </div>
          ))}
        </div>
      </div>
      <ModalFooter>
        <BtnSecondary onClick={onClose}>Annuleren</BtnSecondary>
        <BtnPrimary onClick={handleSave} disabled={saving}>{saving ? 'Opslaan...' : 'Opslaan'}</BtnPrimary>
      </ModalFooter>
    </Modal>
  )
}
