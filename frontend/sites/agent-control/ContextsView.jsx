import { useEffect, useState } from 'react'
import { listAgents, listContexts, listPostProcessActions } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'
import { BtnPrimary } from '@components/Modal.jsx'
import ContextWizard from './ContextWizard.jsx'
import ContextEditModal from './ContextEditModal.jsx'

const ACTION_BADGE = {
  none: 'neutral', hockey_cmds: 'success', poulebord_note: 'primary', roadmap_preanalysis: 'warning',
}

function ContextDetail({ ctx, action, onBack, onEdit }) {
  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>{ctx.name}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit}>Bewerken</button>
          <button onClick={onBack}>← Terug</button>
        </div>
      </div>
      <div style={s.panel}>
        <div style={s.field}>
          <label style={s.label}>Agent</label>
          <div>{ctx.agent_key}</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Pre-run info (wat de agent vooraf te lezen krijgt)</label>
          <textarea readOnly rows={5} value={ctx.pre_run_info} />
        </div>

        {action && (
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ ...s.label, marginBottom: 8 }}>POST-PROCESSING: {action.label}</div>
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
        )}
      </div>
    </div>
  )
}

export default function ContextsView({ onError }) {
  const [agents, setAgents] = useState([])
  const [contexts, setContexts] = useState(null)
  const [actions, setActions] = useState({})
  const [selected, setSelected] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  function refresh() {
    listAgents().then(items => {
      setAgents(items)
      return Promise.all(items.map(a => listContexts(a.agent_key)))
    }).then(lists => setContexts(lists.flat())).catch(err => onError(err.message))
  }

  useEffect(() => {
    refresh()
    listPostProcessActions().then(setActions).catch(err => onError(err.message))
  }, [])

  if (selected) {
    return (
      <>
        <ContextDetail
          ctx={selected}
          action={actions[selected.post_process_action]}
          onBack={() => setSelected(null)}
          onEdit={() => setEditing(true)}
        />
        {editing && (
          <ContextEditModal
            ctx={selected}
            actions={actions}
            onClose={() => setEditing(false)}
            onError={onError}
            onSaved={() => {
              setEditing(false)
              setSelected(null)
              refresh()
            }}
          />
        )}
      </>
    )
  }

  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>Contexten</h2>
        <BtnPrimary onClick={() => setWizardOpen(true)}>+ Nieuwe context</BtnPrimary>
      </div>
      <div style={s.grid}>
        {(contexts || []).map(c => (
          <div key={c.key} style={s.card} onClick={() => setSelected(c)}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 10 }}>agent: {c.agent_key}</div>
            <Badge label={c.post_process_action} variant={ACTION_BADGE[c.post_process_action] || 'neutral'} />
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10, maxHeight: 54, overflow: 'hidden' }}>
              {c.pre_run_info}
            </div>
          </div>
        ))}
        <div style={s.newCard} onClick={() => setWizardOpen(true)}>+ Nieuwe context aanmaken</div>
      </div>

      {wizardOpen && (
        <ContextWizard
          onClose={() => setWizardOpen(false)}
          onError={onError}
          onCreated={() => { setWizardOpen(false); refresh() }}
        />
      )}
    </div>
  )
}
