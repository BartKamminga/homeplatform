import { useState, useEffect } from 'react';
import AccountLayout from '../AccountLayout.jsx';

function toEntries(data) {
  return data.map(e => ({
    version: e.version,
    date: new Date(e.released_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
    changes: e.description ? e.description.split('\n').filter(Boolean) : [e.title],
  }))
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    fetch('/api/changelog?site=account')
      .then(r => r.json())
      .then(data => setEntries(toEntries(data)))
      .catch(() => {})
  }, [])

  const version = entries[0]?.version ?? '…'

  return (
    <AccountLayout title="Changelog">
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 28 }}>
        Huidige versie: <strong style={{ color: 'var(--color-text)' }}>{version}</strong>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {entries.map(entry => (
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
