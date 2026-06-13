import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import Table from '@components/Table.jsx';
import Badge from '@components/Badge.jsx';
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx';
import { api } from '@core/api.js';
import { toggleEndpoint } from '../adminUtils.js';

export default function Groups() {
  const [groups, setGroups]   = useState([]);
  const [users, setUsers]     = useState([]);
  const [error, setError]     = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ name: '', slug: '' });
  const [saving, setSaving]   = useState(false);
  const [memberGroup, setMemberGroup] = useState(null); // groep waarvoor leden beheerd worden

  function load() {
    api.get('/api/admin/groups/').then(setGroups).catch(e => setError(e.message));
  }
  useEffect(() => {
    load();
    api.get('/api/admin/users/').then(setUsers).catch(() => {});
  }, []);

  async function createGroup() {
    setSaving(true);
    try {
      await api.post('/api/admin/groups/', form);
      setShowNew(false);
      setForm({ name: '', slug: '' });
      load();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteGroup(group) {
    if (!confirm(`Groep '${group.name}' verwijderen?`)) return;
    try {
      await api.delete(`/api/admin/groups/${group.id}`);
      load();
    } catch(e) { setError(e.message); }
  }

  async function toggleMember(user, groupSlug, currently) {
    try {
      await toggleEndpoint(`/api/admin/users/${user.id}/groups/${groupSlug}`, currently);
      load();
      setUsers(prev => prev.map(u => {
        if (u.id !== user.id) return u;
        const nextGroups = currently
          ? u.groups.filter(g => g !== groupSlug)
          : [...u.groups, groupSlug];
        return { ...u, groups: nextGroups };
      }));
    } catch(e) { setError(e.message); }
  }

  const columns = [
    { key: 'name',         label: 'Naam' },
    { key: 'slug',         label: 'Slug', render: v => (
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{v}</code>
    )},
    { key: 'member_count', label: 'Leden', render: v => (
      <Badge label={`${v} leden`} variant="neutral" />
    )},
    { key: '_actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setMemberGroup(row)}
          style={{ background: 'var(--color-primary-light, #e8e8ff)', color: 'var(--color-primary)', padding: '4px 10px', fontSize: '12px' }}
        >
          Leden
        </button>
        {!['admins', 'members', 'guest'].includes(row.slug) && (
          <button
            onClick={() => deleteGroup(row)}
            style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '4px 10px', fontSize: '12px' }}
          >
            Verwijderen
          </button>
        )}
      </div>
    )},
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Groepen</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{groups.length} groepen</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: 'var(--color-primary)', color: '#fff', padding: '9px 16px' }}
        >
          + Nieuwe groep
        </button>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={groups} emptyMessage="Geen groepen gevonden" />
      </div>

      {showNew && (
        <Modal title="Nieuwe groep" onClose={() => setShowNew(false)}>
          {[['name', 'Naam'], ['slug', 'Slug (uniek, kleine letters)']].map(([field, label]) => (
            <div key={field} style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>{label}</label>
              <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
            </div>
          ))}
          <ModalFooter>
            <BtnSecondary onClick={() => setShowNew(false)}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={createGroup} disabled={saving}>
              {saving ? 'Opslaan...' : 'Aanmaken'}
            </BtnPrimary>
          </ModalFooter>
        </Modal>
      )}

      {memberGroup && (
        <Modal title={`Leden — ${memberGroup.name}`} onClose={() => { setMemberGroup(null); load(); }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Selecteer de gebruikers die lid zijn van deze groep.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => {
              const active = u.groups.includes(memberGroup.slug);
              return (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleMember(u, memberGroup.slug, active)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 500 }}>{u.username}</span>
                  <code style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{u.email}</code>
                </label>
              );
            })}
          </div>
          <ModalFooter>
            <BtnSecondary onClick={() => { setMemberGroup(null); load(); }}>Sluiten</BtnSecondary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
