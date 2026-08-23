import { useEffect, useState } from 'react'
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx'
import { listAgents, listPostProcessActions, createContext } from './api.js'
import * as s from './styles.js'

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function ActionSchema({ action }) {
  if (!action) return null
  return (
    <div style={{ marginTop: 16, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ ...s.label, marginBottom: 8 }}>SCHEMA VOOR: {action.label}</div>
      <table style={s.schemaTable}>
        <thead>
          <tr><th style={s.schemaTh}>Kant</th><th style={s.schemaTh}>Veld</th><th style={s.schemaTh}>Type</th><th style={s.schemaTh}>Betekenis</th></tr>
        </thead>
        <tbody>
          {action.task_params.length === 0 && (
            <tr><td style={s.schemaTd}>Taak-params (input)</td><td style={s.schemaTd}><code style={s.code}>—</code></td><td style={s.schemaTd}>—</td><td style={s.schemaTd}>Geen parameters nodig</td></tr>
          )}
          {action.task_params.map((f, i) => (
            <tr key={'p' + i}>
              <td style={s.schemaTd}>{i === 0 ? 'Taak-params (input)' : ''}</td>
              <td style={s.schemaTd}><code style={s.code}>{f.name}</code></td>
              <td style={s.schemaTd}>{f.type}{f.required && ', verplicht'}</td>
              <td style={s.schemaTd}>{f.desc}</td>
            </tr>
          ))}
          {action.result_fields.map((f, i) => (
            <tr key={'r' + i}>
              <td style={s.schemaTd}>{i === 0 ? 'Claude-antwoord (output)' : ''}</td>
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

export default function ContextWizard({ onClose, onCreated, onError }) {
  const [step, setStep] = useState(1)
  const [agents, setAgents] = useState([])
  const [actions, setActions] = useState({})
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [agentKey, setAgentKey] = useState('')
  const [preRunInfo, setPreRunInfo] = useState('')
  const [actionKey, setActionKey] = useState('none')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listAgents().then(items => { setAgents(items); if (items.length > 0) setAgentKey(items[0].agent_key) })
    listPostProcessActions().then(setActions)
  }, [])

  function handleNameChange(v) {
    setName(v)
    if (!keyTouched) setKey(slugify(v))
  }

  function handleCreate() {
    setSaving(true)
    createContext({ key, agent_key: agentKey, name, pre_run_info: preRunInfo, post_process_action: actionKey })
      .then(() => onCreated())
      .catch(err => { onError(err.message); setSaving(false) })
  }

  return (
    <Modal title="Nieuwe context" onClose={onClose} width={680}>
      <div style={s.steps}>
        <div style={s.step(step > 1 ? 'done' : step === 1 ? 'active' : 'todo')}>1. Basis</div>
        <div style={s.step(step > 2 ? 'done' : step === 2 ? 'active' : 'todo')}>2. Pre-run info</div>
        <div style={s.step(step > 3 ? 'done' : step === 3 ? 'active' : 'todo')}>3. Post-processing</div>
        <div style={s.step(step === 4 ? 'active' : 'todo')}>4. Controleren</div>
      </div>

      {step === 1 && (
        <>
          <div style={s.field}>
            <label style={s.label}>Naam</label>
            <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Bv. Poulebord: win-analyse per competitie" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Agent</label>
            <select value={agentKey} onChange={e => setAgentKey(e.target.value)}>
              {agents.map(a => <option key={a.agent_key} value={a.agent_key}>{a.name}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Key (uniek)</label>
            <input value={key} onChange={e => { setKey(e.target.value); setKeyTouched(true) }} />
            <div style={s.hint}>Wordt automatisch afgeleid van de naam, maar mag je aanpassen.</div>
          </div>
        </>
      )}

      {step === 2 && (
        <div style={s.field}>
          <label style={s.label}>Pre-run info — wat de agent vooraf moet weten</label>
          <textarea
            value={preRunInfo}
            onChange={e => setPreRunInfo(e.target.value)}
            rows={7}
            placeholder="Beschrijf: welke gegevens krijgt de agent (agent_state), wat moet hij ermee doen, en in welk formaat moet het antwoord terugkomen..."
          />
          <div style={s.hint}>Dit wordt letterlijk meegestuurd naar Claude als onderdeel van de systeemprompt — een vast "sessie"-niveau naast de per-run kennis.</div>
        </div>
      )}

      {step === 3 && (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Kies wat er met het antwoord van de agent mag gebeuren.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {Object.entries(actions).map(([k, a]) => (
              <div
                key={k}
                onClick={() => setActionKey(k)}
                style={{
                  border: `1.5px solid ${actionKey === k ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: actionKey === k ? 'var(--color-primary-light)' : 'transparent',
                  borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
              </div>
            ))}
          </div>
          <ActionSchema action={actions[actionKey]} />
        </>
      )}

      {step === 4 && (
        <div>
          <p><strong>Naam:</strong> {name}</p>
          <p><strong>Agent:</strong> {agentKey}</p>
          <p><strong>Key:</strong> {key}</p>
          <p><strong>Post-processing:</strong> {actions[actionKey]?.label}</p>
          <p style={{ marginTop: 8 }}><strong>Pre-run info:</strong></p>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--color-surface-2)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12 }}>{preRunInfo || '(leeg)'}</pre>
        </div>
      )}

      <ModalFooter>
        {step > 1 && <BtnSecondary onClick={() => setStep(step - 1)}>← Vorige</BtnSecondary>}
        {step < 4 && <BtnPrimary onClick={() => setStep(step + 1)} disabled={step === 1 && (!name || !key)}>Volgende →</BtnPrimary>}
        {step === 4 && <BtnPrimary onClick={handleCreate} disabled={saving}>{saving ? 'Aanmaken...' : 'Context aanmaken'}</BtnPrimary>}
      </ModalFooter>
    </Modal>
  )
}
