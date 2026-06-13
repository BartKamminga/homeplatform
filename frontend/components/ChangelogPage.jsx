// frontend/components/ChangelogPage.jsx
// Gedeeld changelog component — gebruik in elke site

export function toEntries(data) {
  return data.map(e => ({
    version: e.version,
    date: new Date(e.released_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
    changes: e.description ? e.description.split('\n').filter(Boolean) : [e.title],
  }))
}

export default function ChangelogPage({ changelog, title = 'Changelog' }) {
  return (
    <div style={{ maxWidth: 700, padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 24 }}>{title}</h1>
      {changelog.map(entry => (
        <div key={entry.version} style={{
          marginBottom: 12,
          background: 'var(--color-surface, var(--bg-card, #fff))',
          border: '1px solid var(--color-border, var(--border, #e0e0e0))',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 14px',
            background: 'var(--color-surface-2, var(--bg-header, #f7f5f2))',
            borderBottom: '1px solid var(--color-border, var(--border, #e0e0e0))',
            fontSize: 12, fontWeight: 600,
          }}>
            <span style={{ color: 'var(--color-text, var(--text))' }}>v{entry.version}</span>
            <span style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              color: 'var(--color-text-muted, var(--text-muted))',
              fontWeight: 400,
            }}>
              {entry.date}
            </span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {entry.changes.map((change, i) => (
              <div key={i} style={{
                fontSize: 12.5,
                color: 'var(--color-text-muted, var(--text-secondary))',
                padding: '3px 0',
                display: 'flex',
                gap: 8,
              }}>
                <span style={{ color: 'var(--color-success, var(--win, #16a34a))', flexShrink: 0 }}>+</span>
                <span>{change}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
