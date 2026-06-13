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
  const [entries,    setEntries]    = useState([])
  const [siteFilter, setSiteFilter] = useState('alle')
  const [error,      setError]      = useState('')

  useEffect(() => {
    api.get('/api/admin/changelog').then(setEntries).catch(e => setError(e.message))
  }, [])

  const sites = ['alle', ...Array.from(new Set(entries.map(e => e.site))).sort()]
  const visible = siteFilter === 'alle' ? entries : entries.filter(e => e.site === siteFilter)

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
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Changelog</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{visible.length} van {entries.length} entries</p>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '16px' }}>
        {sites.map(s => (
          <button
            key={s}
            onClick={() => setSiteFilter(s)}
            style={{
              padding: '5px 12px', fontSize: 12, borderRadius: 99, fontFamily: 'inherit', cursor: 'pointer',
              border: `1px solid ${siteFilter === s ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: siteFilter === s ? 'var(--color-primary)' : 'var(--color-surface)',
              color: siteFilter === s ? '#fff' : 'var(--color-text)',
              fontWeight: siteFilter === s ? 600 : 400,
            }}
          >{s}</button>
        ))}
      </div>

      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={visible} emptyMessage="Geen changelog entries" />
      </div>
    </AdminLayout>
  )
}
