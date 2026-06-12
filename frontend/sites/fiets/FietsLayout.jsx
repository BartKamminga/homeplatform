import PrognosePage from './pages/PrognosePage.jsx'
import { VERSION } from './changelog.jsx'

export default function FietsLayout() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--color-background)',
      color: 'var(--color-text)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--color-background)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🚴</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>FietsPrognose</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>v{VERSION}</div>
          </div>
        </div>
        <a href="/account/groups?back=/fiets/" style={{
          fontSize: 12, color: 'var(--color-text-muted)',
          textDecoration: 'none', padding: '6px 10px',
          border: '1px solid var(--color-border)', borderRadius: 8,
        }}>Account</a>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <PrognosePage />
      </main>
    </div>
  )
}
