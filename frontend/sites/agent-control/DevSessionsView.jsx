import { useEffect, useState } from 'react'
import { listDevSessions, createDevSession, stopDevSession, startDevSession, removeDevSession } from './api.js'
import * as s from './styles.js'
import Badge from '@components/Badge.jsx'

const STATUS_VARIANT = {
  running:  'success',
  creating: 'warning',
  stopped:  'neutral',
  done:     'success',
  error:    'danger',
  removed:  'neutral',
}

// Mirror van backend/services/dev_session_use_cases.py::USE_CASE_PROFILES -
// alleen om het formulier voor te vullen, de backend blijft de bron van
// waarheid (item 1134).
const USE_CASES = [
  { value: '',              label: 'Vrij (handmatig instellen)' },
  { value: 'mindbox',       label: 'MindBox' },
  { value: 'dev',           label: 'Dev (git)' },
  { value: 'fiets',         label: 'Fiets' },
  { value: 'hockey_inside', label: 'Hockey Inside' },
  { value: 'poulebord',     label: 'Poulebord' },
]
const USE_CASE_DEFAULTS = {
  '':             { gitEnabled: true,  interactive: true },
  mindbox:        { gitEnabled: false, interactive: true },
  dev:            { gitEnabled: true,  interactive: true },
  fiets:          { gitEnabled: false, interactive: false },
  hockey_inside:  { gitEnabled: false, interactive: false },
  poulebord:      { gitEnabled: false, interactive: false },
}

export default function DevSessionsView({ onError }) {
  const [sessions, setSessions] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useCase, setUseCase] = useState('')
  const [gitEnabled, setGitEnabled] = useState(true)
  const [interactive, setInteractive] = useState(true)
  const [envName, setEnvName] = useState('prod')
  const [branch, setBranch] = useState('develop')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  function refresh() {
    listDevSessions().then(setSessions).catch(err => onError(err.message))
  }

  useEffect(refresh, [])

  function handleUseCaseChange(value) {
    setUseCase(value)
    const d = USE_CASE_DEFAULTS[value] || USE_CASE_DEFAULTS['']
    setGitEnabled(d.gitEnabled)
    setInteractive(d.interactive)
  }

  function resetForm() {
    setShowNew(false); setShowAdvanced(false); setName(''); setBranch('develop')
    handleUseCaseChange(''); setEnvName('prod')
  }

  function handleCreate() {
    setBusy(true)
    createDevSession({
      branch, name: name || null,
      use_case: useCase || null, git_enabled: gitEnabled, interactive, env_name: envName,
    })
      .then(() => { resetForm(); refresh() })
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
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {dev.use_case || 'vrij'} · {dev.env_name}{dev.git_enabled && <> · branch: {dev.branch}</>}
            </div>
            {dev.error && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 6 }}>{dev.error}</div>}
            {dev.interactive && dev.remote_control_url && (
              <div style={{ marginTop: 8 }}>
                <a href={dev.remote_control_url} target="_blank" rel="noreferrer">Open in claude.ai/code</a>
                <div style={s.hint}>
                  Betrouwbaarder dan de sidebar op claude.ai/code zelf (die toont niet altijd elke gepairde sessie).
                </div>
              </div>
            )}
            {dev.interactive && !dev.remote_control_url && (
              <div style={s.hint}>
                Verbind via SSH + <span style={s.code}>docker exec -it {dev.container_name} tmux attach -t work</span>{' '}
                en start (of hervat) <span style={s.code}>claude</span>. Typ daarna <span style={s.code}>/remote-control</span>{' '}
                voor een pairing-link (gebeurt niet automatisch) - verschijnt hier zodra 'm gevonden is.
              </div>
            )}
            {!dev.interactive && (
              <div style={{ marginTop: 8 }}>
                <div style={s.label}>Log (headless)</div>
                <pre style={{
                  fontSize: 11, background: 'var(--color-surface-2)', padding: 8, borderRadius: 6,
                  maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap',
                }}>
                  {dev.headless_log || 'Nog geen output.'}
                </pre>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              {dev.status === 'running' && (
                <button onClick={ev => handleAction(stopDevSession, dev.id, ev)}>Stop</button>
              )}
              {(dev.status === 'stopped' || dev.status === 'error' || dev.status === 'done') && (
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
            <div style={s.field}>
              <label style={s.label}>Use case</label>
              <select value={useCase} onChange={e => handleUseCaseChange(e.target.value)}>
                {USE_CASES.map(uc => <option key={uc.value} value={uc.value}>{uc.label}</option>)}
              </select>
            </div>
            {!showAdvanced && (
              <div style={{ ...s.hint, marginBottom: 12, cursor: 'pointer' }} onClick={() => setShowAdvanced(true)}>
                Geavanceerd: omgeving, branch, git/meekijken afwijken van het use-case-default
              </div>
            )}
            {showAdvanced && (
              <>
                <div style={s.field}>
                  <label style={s.label}>Omgeving</label>
                  <select value={envName} onChange={e => setEnvName(e.target.value)}>
                    <option value="prod">prod</option>
                    <option value="acc">acc</option>
                    <option value="local">local</option>
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>
                    <input type="checkbox" checked={gitEnabled} onChange={e => setGitEnabled(e.target.checked)} /> Git-toegang
                    (max 1 tegelijk)
                  </label>
                </div>
                {gitEnabled && (
                  <div style={s.field}>
                    <label style={s.label}>Branch</label>
                    <input value={branch} onChange={e => setBranch(e.target.value)} />
                  </div>
                )}
                <div style={s.field}>
                  <label style={s.label}>
                    <input type="checkbox" checked={interactive} onChange={e => setInteractive(e.target.checked)} /> Live
                    meekijken (tmux + Remote Control) i.p.v. headless
                  </label>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busy} onClick={handleCreate}>Aanmaken</button>
              <button disabled={busy} onClick={resetForm}>Annuleren</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
