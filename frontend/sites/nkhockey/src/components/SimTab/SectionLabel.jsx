import React from 'react'

export default function SectionLabel({ label, style, onPredict, onReset }) {
  return (
    <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }}>
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {onPredict && <div className="whatif-preset-sm" onClick={onPredict} title="Voorspel alle resterende" style={{ background: 'var(--btn-predict-bg)', color: 'var(--btn-predict-text)', fontStyle: 'italic' }}>✦</div>}
        {onReset && <div className="whatif-preset-sm" onClick={onReset} title="Reset alles" style={{ background: 'var(--btn-reset-bg)', color: 'var(--btn-reset-text)' }}>?</div>}
      </div>
    </div>
  )
}
