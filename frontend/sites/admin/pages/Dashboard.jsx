import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';
import Badge from '@components/Badge.jsx';

export default function Dashboard() {
  const [version, setVersion] = useState(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/api/version')
      .then(setVersion)
      .catch(e => setError(e.message));
  }, []);

  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Dashboard</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Versieoverzicht van het platform
      </p>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {version && (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          <InfoCard title="Core versie"    value={version.core}        />
          <InfoCard title="DB revisie"     value={version.db_revision} mono />
          {Object.entries(version.sites || {}).map(([site, v]) => (
            <InfoCard key={site} title={`Site: ${site}`} value={v} />
          ))}
          {Object.keys(version.sites || {}).length === 0 && (
            <InfoCard title="Sites" value="Geen sites geregistreerd" muted />
          )}
        </div>
      )}
    </AdminLayout>
  );
}

function InfoCard({ title, value, mono, muted }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
    }}>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{
        fontSize: '18px',
        fontWeight: 600,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        color: muted ? 'var(--color-text-light)' : 'var(--color-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}
