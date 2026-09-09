import { useEffect, useState } from 'react'
import { listDevSessions, createDevSession, stopDevSession, startDevSession, removeDevSession } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'

const STATUS_VARIANT = {
  running:  'success',
  creating: 'warning',
  stopped:  'neutral',
  error:    'danger',
  removed:  'neutral',
}

export default function DevSessionsView({ onError }) {
  const [sessions, setSessions] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [branch, setBranch] = useState('develop')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  function refresh() {
    listDevSessions().then(setSessions).catch(err => onError(err.message))
  }

  useEffect(refresh, [])

  function handleCreate() {
    setBusy(true)
    createDevSession({ branch, name: name || null })
      .then(() => { setShowNew(false); setShowAdvanced(false); setName(''); setBranch('develop'); refresh() })
      .catch(err => onError(err.message))
      .finally(() => setBusy(false))
  }

  function handleAction(action, id, ev) {
    ev.stopPropagation()
    action(id).then(refresh).catch(err => onError(err.message))
  }

  const visible = (sessions || []).filter(s => s.status !== 'removed')

  return (
    <div>
      <div style={s.topbar}><h2 style={s.h2}>Dev sessions</h2></div>
      {!sessions && <p>Laden...</p>}
      {sessions && visible.length === 0 && !showNew && <p>Nog geen dev-sessions.</p>}
      <div style={s.grid}>
        {visible.map(dev => (
          <div key={dev.id} style={{ ...s.card, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <strong style={{ flex: 1 }}>{dev.name || `Sessie #${dev.id}`}</strong>
              <Badge label={dev.status} variant={STATUS_VARIANT[dev.status] || 'neutral'} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>branch: {dev.branch}</div>
            {dev.error && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 6 }}>{dev.error}</div>}
            <div style={s.hint}>
              Verbind via SSH + <span style={s.code}>docker exec -it {dev.container_name} tmux attach -t work</span>{' '}
              en start (of hervat) <span style={s.code}>claude</span>. Typ daarna <span style={s.code}>/remote-control</span>{' '}
              voor een pairing-link naar claude.ai/code of de mobiele app (gebeurt niet automatisch).
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              {dev.status === 'running' && (
                <button onClick={ev => handleAction(stopDevSession, dev.id, ev)}>Stop</button>
              )}
              {(dev.status === 'stopped' || dev.status === 'error') && (
                <button onClick={ev => handleAction(startDevSession, dev.id, ev)}>Start</button>
              )}
              <button onClick={ev => handleAction(removeDevSession, dev.id, ev)}>Verwijderen</button>
            </div>
          </div>
        ))}
        {!showNew && (
          <div style={s.newCard} onClick={() => setShowNew(true)}>+ Nieuwe sessie</div>
        )}
        {showNew && (
          <div style={s.card}>
            <div style={s.field}>
              <label style={s.label}>Label (optioneel)</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="bv. hockey-feature of mindbox-case-1234" />
            </div>
            {!showAdvanced && (
              <div style={{ ...s.hint, marginBottom: 12, cursor: 'pointer' }} onClick={() => setShowAdvanced(true)}>
                Geavanceerd: andere branch dan <span style={s.code}>develop</span>
              </div>
            )}
            {showAdvanced && (
              <div style={s.field}>
                <label style={s.label}>Branch</label>
                <input value={branch} onChange={e => setBranch(e.target.value)} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busy} onClick={handleCreate}>Aanmaken</button>
              <button disabled={busy} onClick={() => { setShowNew(false); setShowAdvanced(false) }}>Annuleren</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
