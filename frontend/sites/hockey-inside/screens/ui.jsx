import { useState } from 'react'

// Generieke UI-bouwstenen voor hockey-inside, losstaand van queue/cmd-logica
// (die staat in queueShared.jsx). Item 738/740: was eerder allemaal samen in
// queueShared.jsx gepropt, inclusief duplicaten van deze knop-stijlen elders.

// ── InfoTooltip ───────────────────────────────────────────────────────────────

export function InfoTooltip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.7, lineHeight: 1, userSelect: 'none' }}>ⓘ</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 6, padding: '6px 9px', fontSize: 11, lineHeight: 1.4,
          color: 'var(--color-text)', whiteSpace: 'normal', width: 240,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, pointerEvents: 'none',
        }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--color-border)' }} />
        </span>
      )}
    </span>
  )
}

// ── Pill / variant styling ────────────────────────────────────────────────────

export const VARIANT = {
  ok:      { bg: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', fg: 'var(--color-success)', border: 'var(--color-success)' },
  partial: { bg: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))', fg: 'var(--color-warning)', border: 'var(--color-warning)' },
  muted:   { bg: 'var(--color-surface)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' },
}

export function pill(variant) {
  const c = VARIANT[variant] || VARIANT.muted
  return { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
}

// ── Stat-box styles ───────────────────────────────────────────────────────────

export const statBox = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, minWidth: 60 }
export const statNum = { fontSize: 20, fontWeight: 700, lineHeight: 1 }
export const statLbl = { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, textAlign: 'center' }

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtDuration(ms) {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

export function fmtBytes(b) {
  if (!b) return null
  if (b < 1024) return b + 'B'
  if (b < 1024 * 1024) return Math.round(b / 1024) + 'kB'
  return (b / (1024 * 1024)).toFixed(1) + 'MB'
}

// ── Btn (item 740: was gedupliceerd als lokale component in CmdQueueSection) ──

export function Btn({ onClick, disabled, color, filled, children, tooltip, style: extraStyle }) {
  const base = {
    fontSize: 11, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
    transition: 'opacity .15s',
    ...(filled
      ? { border: 'none', background: color || 'var(--color-primary)', color: '#fff' }
      : { border: `1px solid ${color || 'var(--color-border)'}`, background: 'none', color: color || 'var(--color-text)' }
    ),
    opacity: disabled ? 0.5 : 1,
    ...extraStyle,
  }
  return (
    <button onClick={onClick} disabled={disabled} style={base}>
      {children}
      {tooltip && <InfoTooltip text={tooltip} />}
    </button>
  )
}
