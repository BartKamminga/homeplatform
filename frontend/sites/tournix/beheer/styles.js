export const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }
export const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }
export const primaryBtn = { padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const ghostBtn   = { padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }
export const noTid      = { fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }
export const lockBanner = (stage) => ({
  padding: '8px 14px',
  background: 'var(--color-warning)',
  color: '#fff',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  text: stage === 'productie' ? 'Productie — structuur is vergrendeld' : 'Test-modus — alleen simuleren',
})
