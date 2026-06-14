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

// ── FasesTab / PhaseCard styles ──────────────────────────────────────────────
export const card           = { padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 10 }
export const cardLabel      = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase' }
export const muted          = { padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }
export const successBanner  = { padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', color: 'var(--color-success)', fontSize: 13, fontWeight: 500 }
export const errorBanner    = { padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-danger) 15%, var(--color-surface))', color: 'var(--color-danger)', fontSize: 13, fontWeight: 500 }
export const typePill       = { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
export const mainPill       = { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--color-primary)', color: '#fff' }
export const deleteBtn      = { padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }
export const smallDeleteBtn = { marginLeft: 'auto', padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'inherit' }
export const poolCard       = { flex: '1 1 220px', minWidth: 180, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }
export const poolHeader     = { display: 'flex', alignItems: 'center', padding: '7px 12px', background: 'var(--color-primary)', color: '#fff' }
export const teamPoolSelect = { fontSize: 11, padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-background)', color: 'var(--color-text)', cursor: 'pointer' }
export const sectionLabel   = { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }
export const teamChip       = { padding: '3px 10px', fontSize: 12, borderRadius: 99, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
export const slotChip       = { padding: '3px 10px', fontSize: 12, borderRadius: 99, fontStyle: 'italic', background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))', border: '1px dashed var(--color-primary)', color: 'var(--color-primary)' }
export const actionRow      = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }
export const doorGangBox    = { padding: '12px 14px', background: 'rgba(0,0,0,0.03)', border: '1px dashed var(--color-border)', borderRadius: 8, marginBottom: 12 }
export function perPoolBtnStyle(active) {
  return {
    width: 32, height: 32, borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-muted)',
    outline: active ? 'none' : '1px solid var(--color-border)',
  }
}
