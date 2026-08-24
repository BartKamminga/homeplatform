import { useEffect, useState } from 'react'
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx'
import { listAgents, getAgentRegistry, updateContext } from './api.js'
import * as s from './styles.js'

export default function ContextEditModal({ ctx, onClose, onSaved, onError }) {
  const [agents, setAgents] = useState([])
  const [registry, setRegistry] = useState(null)
  const [name, setName] = useState(ctx.name)
  const [agentKey, setAgentKey] = useState(ctx.agent_key)
  const [preRunInfo, setPreRunInfo] = useState(ctx.pre_run_info)
  const [dataSourceKey, setDataSourceKey] = useState(ctx.data_source_key)
  const [postProcessKey, setPostProcessKey] = useState(ctx.post_process_key)
  const [saving, setSaving] = useState(false)

  useEffect(() => { listAgents().then(setAgents) }, [])
  useEffect(() => {
    if (!agentKey) return
    getAgentRegistry(agentKey).then(setRegistry).catch(err => onError(err.message))
  }, [agentKey])

  function handleAgentChange(newAgentKey) {
    setAgentKey(newAgentKey)
    // Bij een andere agent zijn de oude databron/post-process mogelijk ongeldig -
    // reset naar de standaard van de nieuwe agent (harde grens, zie item 939).
    getAgentRegistry(newAgentKey).then(reg => {
      setDataSourceKey(reg.default_data_source || Object.keys(reg.data_sources)[0] || '')
      setPostProcessKey(reg.default_post_process || Object.keys(reg.post_processes)[0] || 'none')
    })
  }

  function handleSave() {
    setSaving(true)
    updateContext(ctx.key, {
      agent_key: agentKey, name, pre_run_info: preRunInfo,
      data_source_key: dataSourceKey, post_process_key: postProcessKey,
    })
      .then(() => onSaved())
      .catch(err => { onError(err.message); setSaving(false) })
  }

  return (
    <Modal title={`Bewerken: ${ctx.key}`} onClose={onClose} width={700}>
      <div style={s.field}>
        <label style={s.label}>Naam</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div style={s.field}>
        <label style={s.label}>Agent</label>
        <select value={agentKey} onChange={e => handleAgentChange(e.target.value)}>
          {agents.map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
        </select>
      </div>
      <div style={s.field}>
        <label style={s.label}>Opdracht</label>
        <textarea value={preRunInfo} onChange={e => setPreRunInfo(e.target.value)} rows={6} />
      </div>

      {registry && (
        <>
          <div style={s.field}>
            <label style={s.label}>Databron</label>
            <select value={dataSourceKey} onChange={e => setDataSourceKey(e.target.value)}>
              {Object.entries(registry.data_sources).map(([k, ds]) => <option key={k} value={k}>{ds.label}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Post-processing-actie</label>
            <select value={postProcessKey} onChange={e => setPostProcessKey(e.target.value)}>
              {Object.entries(registry.post_processes).map(([k, pp]) => <option key={k} value={k}>{pp.label}</option>)}
            </select>
          </div>
        </>
      )}

      <ModalFooter>
        <BtnSecondary onClick={onClose}>Annuleren</BtnSecondary>
        <BtnPrimary onClick={handleSave} disabled={saving}>{saving ? 'Opslaan...' : 'Opslaan'}</BtnPrimary>
      </ModalFooter>
    </Modal>
  )
}
