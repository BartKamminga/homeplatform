import { useEffect, useState } from 'react'
import AdminLayout from '../AdminLayout.jsx'
import Table from '@components/Table.jsx'
import Modal, { ModalFooter, BtnPrimary, BtnSecondary, BtnDanger } from '@components/Modal.jsx'
import { api } from '@core/api.js'

const SITES = ['core', 'admin', 'nkhockey', 'mixmusic']

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

const emptyForm = { version: '', site: 'core', title: '', description: '', released_at: '' }

export default function Changelog() {
  const [entries, setEntries]   = useState([])
  const [error, setError]       = useState('')
  const [showNew, setShowNew]   = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(emptyForm)
  const [saving, setSaving]     = useState(false)

  function load() {
    api.get('/api/admin/changelog').then(setEntries).catch(e => setError(e.message))
  }
  useEffect(load, [])

  function openNew() {
    setForm(emptyForm)
    setEditing(null)
    setShowNew(true)
  }

  function openEdit(entry) {
    setForm({
      version: entry.version,
      site: entry.site,
      title: entry.title,
      description: entry.description || '',
      released_at: entry.released_at?.slice(0, 10) || '',
    })
    setEditing(entry)
    setShowNew(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        released_at: form.released_at ? new Date(form.released_at).toISOString() : undefined,
      }
      if (editing) {
        await api.patch(`/api/admin/changelog/${editing.id}`, payload)
      } else {
        await api.post('/api/admin/changelog', payload)
      }
      setShowNew(false)
      load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function remove(entry) {
    if (!confirm(`"${entry.title}" verwijderen?`)) return
    try {
      await api.delete(`/api/admin/changelog/${entry.id}`)
      load()
    } catch(e) { setError(e.message) }
  }

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
    { key: '_actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => openEdit(row)} style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', padding: '4px 10px', fontSize: '12px' }}>
          Bewerken
        </button>
        <button onClick={() => remove(row)} style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '4px 10px', fontSize: '12px' }}>
          Verwijderen
        </button>
      </div>
    )},
  ]

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Changelog</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{entries.length} entries</p>
        </div>
        <button onClick={openNew} style={{ background: 'var(--color-primary)', color: '#fff', padding: '9px 16px' }}>
          + Nieuwe entry
        </button>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={entries} emptyMessage="Nog geen changelog entries" />
      </div>

      {showNew && (
        <Modal title={editing ? 'Entry bewerken' : 'Nieuwe entry'} onClose={() => setShowNew(false)} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>Versie</label>
              <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="bijv. 1.2.0" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>Site</label>
              <select value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))}>
                {SITES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>Titel</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Korte omschrijving" />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>Beschrijving</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="Optionele details..."
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>Releasedatum</label>
            <input type="date" value={form.released_at} onChange={e => setForm(f => ({ ...f, released_at: e.target.value }))} />
          </div>

          <ModalFooter>
            <BtnSecondary onClick={() => setShowNew(false)}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={save} disabled={saving}>
              {saving ? 'Opslaan...' : editing ? 'Bijwerken' : 'Aanmaken'}
            </BtnPrimary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  )
}
