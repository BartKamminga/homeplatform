import { useEffect, useState } from 'react'
import { listAgents, listContexts, getAgentRegistry, getKnowledge, deleteContext } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'
import { BtnPrimary } from '@components/Modal.jsx'
import ContextWizard from './ContextWizard.jsx'
import ContextEditModal from './ContextEditModal.jsx'

function ContextDetail({ ctx, registry, onBack, onEdit, onDelete }) {
  const dataSource = registry?.data_sources?.[ctx.data_source_key]
  const postProcess = registry?.post_processes?.[ctx.post_process_key]

  // Kennis (laatste notes) specifiek van deze context - los van de kennis van
  // andere contexten binnen dezelfde agent (item 943).
  const [knowledge, setKnowledge] = useState(null)
  useEffect(() => {
    getKnowledge(ctx.agent_key, ctx.key).then(setKnowledge).catch(() => {})
  }, [ctx.agent_key, ctx.key])

  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>{ctx.name}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit}>Bewerken</button>
          <button onClick={() => { if (confirm(`Context "${ctx.name}" weggooien?`)) onDelete() }}>Weggooien</button>
          <button onClick={onBack}>← Terug</button>
        </div>
      </div>
      <div style={s.panel}>
        <div style={s.field}>
          <label style={s.label}>Agent</label>
          <div>{registry?.label || ctx.agent_key}</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Opdracht (wat de agent vooraf te lezen krijgt en moet doen)</label>
          <textarea readOnly rows={5} value={ctx.pre_run_info} />
        </div>

        {knowledge?.notes && (
          <div style={s.field}>
            <label style={s.label}>Kennis (notes van de laatste run van deze context, {new Date(knowledge.updated_at).toLocaleString('nl-NL')})</label>
            <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--color-surface-2)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12, margin: 0 }}>
              {knowledge.notes}
            </pre>
          </div>
        )}

        <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 12 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>DATABRON: {dataSource?.label || ctx.data_source_key}</div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{dataSource?.desc}</p>
          {dataSource?.params?.length > 0 && (
            <table style={s.schemaTable}>
              <thead><tr><th style={s.schemaTh}>Taak-param</th><th style={s.schemaTh}>Type</th><th style={s.schemaTh}>Betekenis</th></tr></thead>
              <tbody>
                {dataSource.params.map((f, i) => (
                  <tr key={i}>
                    <td style={s.schemaTd}><code style={s.code}>{f.name}</code></td>
                    <td style={s.schemaTd}>{f.type}{f.required && ', verplicht'}</td>
                    <td style={s.schemaTd}>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>POST-PROCESSING: {postProcess?.label || ctx.post_process_key}</div>
          {postProcess?.result_fields?.length > 0 && (
            <table style={s.schemaTable}>
              <thead><tr><th style={s.schemaTh}>Claude-antwoord</th><th style={s.schemaTh}>Type</th><th style={s.schemaTh}>Betekenis</th></tr></thead>
              <tbody>
                {postProcess.result_fields.map((f, i) => (
                  <tr key={i}>
                    <td style={s.schemaTd}><code style={s.code}>{f.name}</code></td>
                    <td style={s.schemaTd}>{f.type}{f.required && ', verplicht'}</td>
                    <td style={s.schemaTd}>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ContextsView({ onError, lockedAgentKey }) {
  const [agents, setAgents] = useState([])
  const [contexts, setContexts] = useState(null)
  const [registries, setRegistries] = useState({})
  const [selected, setSelected] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  function refresh() {
    listAgents().then(items => {
      setAgents(items)
      return Promise.all(items.map(a =>
        getAgentRegistry(a.agent_key).then(reg => [a.agent_key, reg])
      ))
    }).then(pairs => setRegistries(Object.fromEntries(pairs)))
      .then(() => listContexts())
      .then(setContexts)
      .catch(err => onError(err.message))
  }

  useEffect(refresh, [])

  function handleDelete(key) {
    deleteContext(key).then(() => { setSelected(null); refresh() }).catch(err => onError(err.message))
  }

  if (selected) {
    return (
      <>
        <ContextDetail
          ctx={selected}
          registry={registries[selected.agent_key]}
          onBack={() => setSelected(null)}
          onEdit={() => setEditing(true)}
          onDelete={() => handleDelete(selected.key)}
        />
        {editing && (
          <ContextEditModal
            ctx={selected}
            onClose={() => setEditing(false)}
            onError={onError}
            onSaved={() => { setEditing(false); setSelected(null); refresh() }}
          />
        )}
      </>
    )
  }

  const visibleContexts = lockedAgentKey ? (contexts || []).filter(c => c.agent_key === lockedAgentKey) : contexts

  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>Contexten</h2>
        <BtnPrimary onClick={() => setWizardOpen(true)}>+ Nieuwe context</BtnPrimary>
      </div>
      <div style={s.grid}>
        {(visibleContexts || []).map(c => {
          const reg = registries[c.agent_key]
          const postProcess = reg?.post_processes?.[c.post_process_key]
          return (
            <div key={c.key} style={s.card} onClick={() => setSelected(c)}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.name}</div>
              {!lockedAgentKey && <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 10 }}>agent: {reg?.label || c.agent_key}</div>}
              <Badge label={postProcess?.label || c.post_process_key} variant="primary" />
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10, maxHeight: 54, overflow: 'hidden' }}>
                {c.pre_run_info}
              </div>
            </div>
          )
        })}
        <div style={s.newCard} onClick={() => setWizardOpen(true)}>+ Nieuwe context aanmaken</div>
      </div>

      {wizardOpen && (
        <ContextWizard
          onClose={() => setWizardOpen(false)}
          onError={onError}
          onCreated={() => { setWizardOpen(false); refresh() }}
          defaultAgentKey={lockedAgentKey}
        />
      )}
    </div>
  )
}
