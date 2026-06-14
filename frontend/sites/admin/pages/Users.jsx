import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import Table from '@components/Table.jsx';
import Badge from '@components/Badge.jsx';
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx';
import { api } from '@core/api.js';
import { toggleEndpoint } from '../adminUtils.js';

export default function Users() {
  const [users, setUsers]       = useState([]);
  const [groups, setGroups]     = useState([]);
  const [error, setError]       = useState('');
  const [showNew, setShowNew]       = useState(false);
  const [form, setForm]             = useState({ username: '', email: '', password: '', locale: 'nl' });
  const [saving, setSaving]         = useState(false);
  const [groupUser, setGroupUser]   = useState(null);
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteGroup, setInviteGroup]   = useState('');
  const [inviteLink, setInviteLink]     = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  function load() {
    api.get('/api/admin/users/').then(setUsers).catch(e => setError(e.message));
  }
  useEffect(() => {
    load();
    api.get('/api/admin/groups/').then(setGroups).catch(() => {});
  }, []);

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

  async function createInvite() {
    try {
      const result = await api.post('/api/auth/invite', { group_slug: inviteGroup || null });
      const link = `${window.location.origin}/account/invite/${result.token}`;
      setInviteLink(link);
      setInviteCopied(false);
    } catch(e) { setError(e.message); }
  }

  function copyInvite() {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  }

  async function toggleActive(user) {
    await api.patch(`/api/admin/users/${user.id}`, { is_active: !user.is_active });
    load();
  }

  async function deleteUser(user) {
    if (!window.confirm(`Gebruiker "${user.username}" permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return
    try {
      await api.delete(`/api/admin/users/${user.id}`)
      load()
    } catch(e) { setError(e.message) }
  }

  async function toggleGroup(user, groupSlug, currently) {
    try {
      await toggleEndpoint(`/api/admin/users/${user.id}/groups/${groupSlug}`, currently);
      load();
      setGroupUser(prev => {
        if (!prev || prev.id !== user.id) return prev;
        const nextGroups = currently
          ? prev.groups.filter(g => g !== groupSlug)
          : [...prev.groups, groupSlug];
        return { ...prev, groups: nextGroups };
      });
    } catch(e) { setError(e.message); }
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
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setGroupUser(row)}
          style={{ background: 'var(--color-primary-light, #e8e8ff)', color: 'var(--color-primary)', padding: '4px 10px', fontSize: '12px' }}
        >
          Groepen
        </button>
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
        <button
          onClick={() => deleteUser(row)}
          style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '4px 10px', fontSize: '12px' }}
        >
          ✕ Verwijderen
        </button>
      </div>
    )},
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Gebruikers</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{users.length} gebruikers</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowInvite(true); setInviteGroup(''); setInviteLink(''); setError(''); }}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '9px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '14px' }}
          >
            ✉ Uitnodigen
          </button>
          <button
            onClick={() => setShowNew(true)}
            style={{ background: 'var(--color-primary)', color: '#fff', padding: '9px 16px' }}
          >
            + Nieuwe gebruiker
          </button>
        </div>
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

      {showInvite && !inviteLink && (
        <Modal title="Uitnodiging versturen" onClose={() => setShowInvite(false)}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Kies de groep waarvoor je uitnodigt. De nieuwe gebruiker wordt meteen lid.
          </p>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Groep
            </label>
            <select
              value={inviteGroup}
              onChange={e => setInviteGroup(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }}
            >
              <option value="">— Geen groep (alleen admin)</option>
              {groups.filter(g => g.slug !== 'admins').map(g => (
                <option key={g.id} value={g.slug}>{g.name} ({g.slug})</option>
              ))}
            </select>
          </div>
          {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</p>}
          <ModalFooter>
            <BtnSecondary onClick={() => setShowInvite(false)}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={createInvite}>Link genereren</BtnPrimary>
          </ModalFooter>
        </Modal>
      )}

      {showInvite && inviteLink && (
        <Modal title="Uitnodigingslink" onClose={() => { setShowInvite(false); setInviteLink(''); }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
            Stuur deze link naar de persoon die je wilt uitnodigen. De link is 7 dagen geldig en eenmalig.
            {inviteGroup && <><br /><strong>Groep: {inviteGroup}</strong></>}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly value={inviteLink}
              onClick={e => e.target.select()}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none' }}
            />
            <button
              onClick={copyInvite}
              style={{ padding: '8px 14px', fontSize: '13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: inviteCopied ? '#22c55e' : 'var(--color-surface)', color: inviteCopied ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background 0.2s' }}
            >
              {inviteCopied ? '✓ Gekopieerd' : 'Kopieer'}
            </button>
          </div>
          <ModalFooter>
            <BtnSecondary onClick={() => { setShowInvite(false); setInviteLink(''); }}>Sluiten</BtnSecondary>
          </ModalFooter>
        </Modal>
      )}

      {groupUser && (
        <Modal title={`Groepen — ${groupUser.username}`} onClose={() => { setGroupUser(null); load(); }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Selecteer de groepen waarvan deze gebruiker lid is.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map(g => {
              const active = groupUser.groups.includes(g.slug);
              return (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleGroup(groupUser, g.slug, active)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <code style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{g.slug}</code>
                </label>
              );
            })}
          </div>
          <ModalFooter>
            <BtnSecondary onClick={() => { setGroupUser(null); load(); }}>Sluiten</BtnSecondary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
