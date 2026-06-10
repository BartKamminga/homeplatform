import { useEffect, useState } from 'react'
import AdminLayout from '../AdminLayout.jsx'
import Table from '@components/Table.jsx'
import { api } from '@core/api.js'

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export default function Changelog() {
  const [entries, setEntries] = useState([])
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get('/api/admin/changelog').then(setEntries).catch(e => setError(e.message))
  }, [])

  const columns = [
    { key: 'released_at', label: 'Datum', render: v => (
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{formatDate(v)}</span>
    )},
    { key: 'site', label: 'Site', render: v => (
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{v}</code>
    )},
    { key: 'version', label: 'Versie', render: v => (
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{v}</code>
    )},
    { key: 'title', label: 'Titel' },
    { key: 'description', label: 'Omschrijving', render: v => (
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{v || '—'}</span>
    )},
  ]

  return (
    <AdminLayout>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Changelog</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{entries.length} entries — beheerd via deploy-migraties</p>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={entries} emptyMessage="Nog geen changelog entries" />
      </div>
    </AdminLayout>
  )
}
