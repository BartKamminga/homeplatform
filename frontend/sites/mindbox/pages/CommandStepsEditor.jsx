import { fieldStyle, iconBtnStyle, pillStyle } from './commandStyles.js'

// Item 1053: uitgelicht uit CommandsPage.jsx (bestandsgrens-afspraak) - de
// stappen-subeditor van een commando. kind="api_call" kiest uit de
// elementaire-acties-lijst (GET /commands/actions) en vult cli_hint voor,
// kind="manual" heeft geen cli_hint (vereist LLM/Bart-oordeel).
export default function CommandStepsEditor({ steps, actions, onSetStep, onAddStep, onRemoveStep, onMoveStep }) {
  const actionGroups = [...new Set(actions.map(a => a.group))]

  return (
    <>
      {steps.map((step, i) => (
        <div key={i} style={{ padding: 10, marginBottom: 8, background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-light)', fontWeight: 600 }}>Stap {i + 1}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onSetStep(i, { kind: 'api_call', action_key: step.action_key || 'Run' })} style={pillStyle(step.kind === 'api_call')}>⚙ CLI</button>
              <button onClick={() => onSetStep(i, { kind: 'manual', action_key: null, cli_hint: '' })} style={pillStyle(step.kind === 'manual')}>🧠 Handmatig</button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button onClick={() => onMoveStep(i, -1)} style={iconBtnStyle}>↑</button>
              <button onClick={() => onMoveStep(i, 1)} style={iconBtnStyle}>↓</button>
              <button onClick={() => onRemoveStep(i)} style={iconBtnStyle}>✕</button>
            </div>
          </div>
          <textarea
            value={step.instruction}
            onChange={e => onSetStep(i, { instruction: e.target.value })}
            placeholder="Instructie (NL, mag {id}/{name}/{env} bevatten)..."
            style={{ ...fieldStyle, minHeight: 40, resize: 'vertical', marginBottom: step.kind === 'api_call' ? 6 : 0 }}
          />
          {step.kind === 'api_call' && (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8 }}>
              <select
                value={step.action_key || ''}
                onChange={e => {
                  const found = actions.find(a => a.key === e.target.value)
                  onSetStep(i, { action_key: e.target.value, cli_hint: found?.template || step.cli_hint })
                }}
                style={fieldStyle}
              >
                <option value="">- kies actie -</option>
                {actionGroups.map(g => (
                  <optgroup key={g} label={g}>
                    {actions.filter(a => a.group === g).map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <input
                value={step.cli_hint || ''}
                onChange={e => onSetStep(i, { cli_hint: e.target.value })}
                style={{ ...fieldStyle, fontFamily: 'monospace' }}
              />
            </div>
          )}
        </div>
      ))}
      <button onClick={onAddStep} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', marginBottom: 12 }}>
        + Stap toevoegen
      </button>
    </>
  )
}
