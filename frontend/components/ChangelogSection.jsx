export default function ChangelogSection({ changelog, version }) {
  return (
    <div>
      {changelog.map(entry => (
        <div key={entry.version} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent, var(--color-primary))' }}>
              v{entry.version}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted, var(--color-text-muted))' }}>{entry.date}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {entry.changes.map((c, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--muted, var(--color-text-muted))', lineHeight: 1.5 }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {version && (
        <div style={{ fontSize: 11, color: 'var(--muted, var(--color-text-muted))', marginTop: 4, opacity: 0.6 }}>
          versie {version}
        </div>
      )}
    </div>
  )
}
