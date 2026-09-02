// Gedeelde stijlen tussen CommandsPage.jsx en CommandStepsEditor.jsx - los
// bestand i.p.v. cross-imports tussen de twee componenten (item 1053).
export const labelStyle = { display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }
export const fieldStyle = { width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', fontFamily: 'inherit' }
export const iconBtnStyle = { padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }

export function pillStyle(active) {
  return {
    fontSize: 11, padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
    border: active ? 'none' : '1px solid var(--color-border)',
    background: active ? 'var(--color-primary-light)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
    fontWeight: active ? 600 : 400,
  }
}
