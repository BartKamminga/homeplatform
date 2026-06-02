import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import Table from '@components/Table.jsx';
import Badge from '@components/Badge.jsx';
import Modal, { ModalFooter, BtnPrimary, BtnSecondary, BtnDanger } from '@components/Modal.jsx';
import { api } from '@core/api.js';

export default function Users() {
  const [users, setUsers]       = useState([]);
  const [error, setError]       = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [form, setForm]         = useState({ username: '', email: '', password: '', locale: 'nl' });
  const [saving, setSaving]     = useState(false);

  function load() {
    api.get('/api/admin/users/').then(setUsers).catch(e => setError(e.message));
  }
  useEffect(load, []);

  async function createUser() {
    setSaving(true);
    try {
      await api.post('/api/admin/users/', form);
      setShowNew(false);
      setForm({ username: '', email: '', password: '', locale: 'nl' });
      load();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(user) {
    await api.patch(`/api/admin/users/${user.id}`, { is_active: !user.is_active });
    load();
  }

  const columns = [
    { key: 'username', label: 'Gebruikersnaam' },
    { key: 'email',    label: 'Email' },
    { key: 'groups',   label: 'Groepen', render: v => v.map(g => (
      <Badge key={g} label={g} variant="primary" />
    ))},
    { key: 'is_active', label: 'Status', render: v => (
      <Badge label={v ? 'Actief' : 'Geblokkeerd'} variant={v ? 'success' : 'danger'} />
    )},
    { key: '_actions', label: '', render: (_, row) => (
      <button
        onClick={() => toggleActive(row)}
        style={{
          background: row.is_active ? 'var(--color-danger-light)' : 'var(--color-success-light)',
          color: row.is_active ? 'var(--color-danger)' : 'var(--color-success)',
          padding: '4px 10px', fontSize: '12px',
        }}
      >
        {row.is_active ? 'Blokkeren' : 'Activeren'}
      </button>
    )},
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Gebruikers</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{users.length} gebruikers</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: 'var(--color-primary)', color: '#fff', padding: '9px 16px' }}
        >
          + Nieuwe gebruiker
        </button>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={users} emptyMessage="Geen gebruikers gevonden" />
      </div>

      {showNew && (
        <Modal title="Nieuwe gebruiker" onClose={() => setShowNew(false)}>
          {['username', 'email', 'password'].map(field => (
            <div key={field} style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>
                {field === 'username' ? 'Gebruikersnaam' : field === 'email' ? 'Email' : 'Wachtwoord'}
              </label>
              <input
                type={field === 'password' ? 'password' : 'text'}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
          <ModalFooter>
            <BtnSecondary onClick={() => setShowNew(false)}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={createUser} disabled={saving}>
              {saving ? 'Opslaan...' : 'Aanmaken'}
            </BtnPrimary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
