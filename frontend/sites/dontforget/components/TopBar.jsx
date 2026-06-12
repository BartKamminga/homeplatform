export default function TopBar({ title, subtitle, onAdd, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '14px 16px',
      borderBottom: '0.5px solid var(--border)',
      background: 'var(--bg-card)', gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
      {onAdd && (
        <button onClick={onAdd} style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <i className="ti ti-plus" style={{ fontSize: 18, color: '#fff' }} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
