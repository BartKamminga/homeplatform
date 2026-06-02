// frontend/components/Table.jsx

export default function Table({ columns, rows, emptyMessage = 'Geen gegevens' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 'var(--font-size-sm)',
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            {columns.map(col => (
              <th key={col.key} style={{
                textAlign: 'left',
                padding: '8px 12px',
                color: 'var(--color-text-muted)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--color-text-light)',
              }}>
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{
              borderBottom: '1px solid var(--color-border)',
              transition: 'background .1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding: '9px 12px' }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
