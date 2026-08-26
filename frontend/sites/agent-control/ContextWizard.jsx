import { useEffect, useState } from 'react'
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx'
import { listAgents, getAgentRegistry, createContext } from './api.js'
import * as s from './styles.js'

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function SchemaTable({ title, rows, kind }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ marginTop: 16, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
        <div style={{ ...s.label, marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Geen parameters/velden nodig.</p>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 16, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ ...s.label, marginBottom: 8 }}>{title}</div>
      <table style={s.schemaTable}>
        <thead>
          <tr><th style={s.schemaTh}>Veld</th><th style={s.schemaTh}>Type</th><th style={s.schemaTh}>Betekenis</th></tr>
        </thead>
        <tbody>
          {rows.map((f, i) => (
            <tr key={i}>
              <td style={s.schemaTd}><code style={s.code}>{f.name}</code></td>
              <td style={s.schemaTd}>{f.type}{f.required && ', verplicht'}</td>
              <td style={s.schemaTd}>{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ContextWizard({ onClose, onCreated, onError, defaultAgentKey }) {
  const [step, setStep] = useState(1)
  const [agents, setAgents] = useState([])
  const [registry, setRegistry] = useState(null)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [agentKey, setAgentKey] = useState(defaultAgentKey || '')
  const [dataSourceKey, setDataSourceKey] = useState('')
  const [preRunInfo, setPreRunInfo] = useState('')
  const [postProcessKey, setPostProcessKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listAgents().then(items => {
      setAgents(items)
      if (!defaultAgentKey && items.length > 0) setAgentKey(items[0].agent_key)
    })
  }, [])

  useEffect(() => {
    if (!agentKey) return
    getAgentRegistry(agentKey).then(reg => {
      setRegistry(reg)
      setDataSourceKey(reg.default_data_source || Object.keys(reg.data_sources)[0] || '')
      setPostProcessKey(reg.default_post_process || Object.keys(reg.post_processes)[0] || 'none')
    }).catch(err => onError(err.message))
  }, [agentKey])

  function handleNameChange(v) {
    setName(v)
    if (!keyTouched) setKey(slugify(v))
  }

  function handleCreate() {
    setSaving(true)
    createContext({
      key, agent_key: agentKey, name, pre_run_info: preRunInfo,
      data_source_key: dataSourceKey, post_process_key: postProcessKey,
    })
      .then(() => onCreated())
      .catch(err => { onError(err.message); setSaving(false) })
  }

  const dataSource = registry?.data_sources?.[dataSourceKey]
  const postProcess = registry?.post_processes?.[postProcessKey]

  return (
    <Modal title="Nieuwe context" onClose={onClose} width={700}>
      <div style={s.steps}>
        <div style={s.step(step > 1 ? 'done' : step === 1 ? 'active' : 'todo')}>1. Basis</div>
        <div style={s.step(step > 2 ? 'done' : step === 2 ? 'active' : 'todo')}>2. Databron</div>
        <div style={s.step(step > 3 ? 'done' : step === 3 ? 'active' : 'todo')}>3. Opdracht</div>
        <div style={s.step(step > 4 ? 'done' : step === 4 ? 'active' : 'todo')}>4. Post-processing</div>
        <div style={s.step(step === 5 ? 'active' : 'todo')}>5. Controleren</div>
      </div>

      {step === 1 && (
        <>
          <div style={s.field}>
            <label style={s.label}>Naam</label>
            <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Bv. Poulebord: win-analyse per competitie" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Agent (domein)</label>
            {defaultAgentKey ? (
              <div>{agents.find(a => a.agent_key === defaultAgentKey)?.name || defaultAgentKey}</div>
            ) : (
              <>
                <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
                  {agents.map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
                </select>
                <div style={s.hint}>Bepaalt welke databronnen en post-processen hierna te kiezen zijn — elke agent heeft zijn eigen, gesloten set.</div>
              </>
            )}
          </div>
          <div style={s.field}>
            <label style={s.label}>Key (uniek)</label>
            <input value={key} onChange={e => { setKey(e.target.value); setKeyTouched(true) }} />
          </div>
        </>
      )}

      {step === 2 && registry && (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Kies welke data de agent vooraf mag lezen — alleen databronnen van agent <strong>{registry.label}</strong>.
          </p>
          {Object.entries(registry.data_sources).map(([k, ds]) => (
            <div
              key={k}
              onClick={() => setDataSourceKey(k)}
              style={{
                border: `1.5px solid ${dataSourceKey === k ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: dataSourceKey === k ? 'var(--color-primary-light)' : 'transparent',
                borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer', marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{ds.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{ds.desc}</div>
            </div>
          ))}
          <SchemaTable title={`Taak-params voor: ${dataSource?.label || ''}`} rows={dataSource?.params} />
        </>
      )}

      {step === 3 && (
        <div style={s.field}>
          <label style={s.label}>Opdracht — wat moet de agent met deze data doen</label>
          <textarea
            value={preRunInfo}
            onChange={e => setPreRunInfo(e.target.value)}
            rows={7}
            placeholder="Bv. Analyseer de meegegeven stand en bepaal kort en bondig wat een team moet doen om te winnen..."
          />
          <div style={s.hint}>Dit is de vrije instructietekst — de technische details van de databron/het antwoord staan al vast in de vorige/volgende stap.</div>
        </div>
      )}

      {step === 4 && registry && (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Kies wat er met het antwoord mag gebeuren — alleen post-processen van agent <strong>{registry.label}</strong>.
          </p>
          {Object.entries(registry.post_processes).map(([k, pp]) => (
            <div
              key={k}
              onClick={() => setPostProcessKey(k)}
              style={{
                border: `1.5px solid ${postProcessKey === k ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: postProcessKey === k ? 'var(--color-primary-light)' : 'transparent',
                borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer', marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{pp.label}</div>
            </div>
          ))}
          <SchemaTable title={`Claude moet teruggeven voor: ${postProcess?.label || ''}`} rows={postProcess?.result_fields} />
        </>
      )}

      {step === 5 && (
        <div>
          <p><strong>Naam:</strong> {name}</p>
          <p><strong>Agent:</strong> {registry?.label}</p>
          <p><strong>Key:</strong> {key}</p>
          <p><strong>Databron:</strong> {dataSource?.label}</p>
          <p><strong>Post-processing:</strong> {postProcess?.label}</p>
          <p style={{ marginTop: 8 }}><strong>Opdracht:</strong></p>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--color-surface-2)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12 }}>{preRunInfo || '(leeg)'}</pre>
        </div>
      )}

      <ModalFooter>
        {step > 1 && <BtnSecondary onClick={() => setStep(step - 1)}>← Vorige</BtnSecondary>}
        {step < 5 && <BtnPrimary onClick={() => setStep(step + 1)} disabled={step === 1 && (!name || !key)}>Volgende →</BtnPrimary>}
        {step === 5 && <BtnPrimary onClick={handleCreate} disabled={saving}>{saving ? 'Aanmaken...' : 'Context aanmaken'}</BtnPrimary>}
      </ModalFooter>
    </Modal>
  )
}
