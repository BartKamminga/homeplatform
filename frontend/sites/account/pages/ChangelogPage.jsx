import AccountLayout from '../AccountLayout.jsx';
import { CHANGELOG, VERSION } from '../changelog.jsx';

export default function ChangelogPage() {
  return (
    <AccountLayout title="Changelog">
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 28 }}>
        Huidige versie: <strong style={{ color: 'var(--color-text)' }}>{VERSION}</strong>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CHANGELOG.map(entry => (
          <div key={entry.version} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>v{entry.version}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{entry.date}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entry.changes.map((c, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AccountLayout>
  );
}
