import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import Table from '@components/Table.jsx';
import { api } from '@core/api.js';

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState({ action: '', site: '' });

  function load() {
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (filter.action) params.set('action', filter.action);
    if (filter.site)   params.set('site',   filter.site);
    api.get(`/api/admin/audit-log/?${params}`)
      .then(data => { setEntries(data.items); setTotal(data.total); })
      .catch(e => setError(e.message));
  }

  useEffect(() => { setPage(0); }, [filter]);
  useEffect(load, [filter, page]);

  const pages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    { key: 'created_at', label: 'Tijd', render: v => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {new Date(v).toLocaleString('nl-NL')}
      </span>
    )},
    { key: 'action', label: 'Actie', render: v => (
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{v}</code>
    )},
    { key: 'site',    label: 'Site' },
    { key: 'user_id', label: 'Gebruiker', render: v => v
      ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>{v.slice(0,8)}…</span>
      : <span style={{ color: 'var(--color-text-light)' }}>—</span>
    },
    { key: 'payload', label: 'Details', render: v => v
      ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>{JSON.stringify(v)}</span>
      : null
    },
  ];

  return (
    <AdminLayout>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Audit log</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {total} {total === 1 ? 'entry' : 'entries'} totaal
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <input
          placeholder="Filter op actie (bijv. user.create)"
          value={filter.action}
          onChange={e => setFilter(f => ({ ...f, action: e.target.value }))}
          style={{ maxWidth: '280px' }}
        />
        <input
          placeholder="Filter op site"
          value={filter.site}
          onChange={e => setFilter(f => ({ ...f, site: e.target.value }))}
          style={{ maxWidth: '180px' }}
        />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={entries} emptyMessage="Geen log-entries gevonden" />
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0} style={pageBtn}>‹ Vorige</button>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Pagina {page + 1} / {pages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pages - 1} style={pageBtn}>Volgende ›</button>
        </div>
      )}
    </AdminLayout>
  );
}

const pageBtn = {
  padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)', cursor: 'pointer',
}
