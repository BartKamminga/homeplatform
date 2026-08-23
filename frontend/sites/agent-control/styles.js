export const shell = {
  display: 'flex', minHeight: '100vh',
}

export const sidebar = {
  width: 200, flexShrink: 0, padding: '20px 14px',
  background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
}

export const sidebarTitle = { fontSize: 15, fontWeight: 600, marginBottom: 2 }
export const sidebarSub = { fontSize: 11, color: 'var(--color-text-light)', marginBottom: 20 }

export function navItem(active) {
  return {
    padding: '8px 10px', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer', marginBottom: 2,
    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
    background: active ? 'var(--color-primary-light)' : 'transparent',
    fontWeight: active ? 600 : 400,
  }
}

export const main = { flex: 1, padding: '28px 36px', maxWidth: 980 }
export const topbar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }
export const h2 = { fontSize: 20, margin: 0 }

export const panel = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: 24,
}

export const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }

export const card = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: 16, cursor: 'pointer',
}

export const newCard = {
  ...card,
  border: '1.5px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text-muted)', fontSize: 13, minHeight: 110,
}

export const field = { marginBottom: 18 }
export const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }
export const hint = { fontSize: 11, color: 'var(--color-text-light)', marginTop: 5 }

export const schemaTable = { width: '100%', borderCollapse: 'collapse', fontSize: 12 }
export const schemaTh = { textAlign: 'left', color: 'var(--color-text-light)', fontWeight: 600, padding: '4px 8px 6px', borderBottom: '1px solid var(--color-border)' }
export const schemaTd = { padding: '6px 8px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }
export const code = { background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 4, fontSize: 11.5, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }

export const steps = { display: 'flex', marginBottom: 26 }
export function step(state) {
  const color = state === 'active' ? 'var(--color-primary)' : state === 'done' ? 'var(--color-success)' : 'var(--color-text-light)'
  return {
    flex: 1, textAlign: 'center', paddingBottom: 10, borderBottom: `2px solid ${color}`,
    color, fontSize: 12, fontWeight: state === 'active' ? 600 : 400,
  }
}
