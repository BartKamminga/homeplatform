export default function InlineConfirm({ msg, onConfirm, onCancel }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, fontSize: 12, minWidth: 120 }}>{msg}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
          color: 'var(--color-text)', fontFamily: 'inherit',
        }}>Nee</button>
        <button onClick={onConfirm} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: 'none', background: 'var(--color-danger)', color: '#fff',
          fontFamily: 'inherit', fontWeight: 600,
        }}>Ja</button>
      </div>
    </div>
  )
}
