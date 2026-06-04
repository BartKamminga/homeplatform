import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import Table from '@components/Table.jsx';
import Badge from '@components/Badge.jsx';
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx';
import ThemeSwitcher from '@components/ThemeSwitcher.jsx';
import { api } from '@core/api.js';

const DEFAULT_TOKENS = {
  '--color-primary': '#534AB7',
  '--color-surface': '#F1EFE8',
  '--color-background': '#FFFFFF',
  '--color-text': '#2C2C2A',
};

export default function Themes() {
  const [themes, setThemes]   = useState([]);
  const [error, setError]     = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ name: '', tokens: JSON.stringify(DEFAULT_TOKENS, null, 2) });
  const [saving, setSaving]   = useState(false);

  function load() {
    api.get('/api/admin/themes/').then(setThemes).catch(e => setError(e.message));
  }
  useEffect(load, []);

  async function activateTheme(theme) {
    try {
      await api.post(`/api/admin/themes/${theme.id}/activate`);
      load();
    } catch(e) { setError(e.message); }
  }

  async function createTheme() {
    setSaving(true);
    try {
      const tokens = JSON.parse(form.tokens);
      await api.post('/api/admin/themes/', { name: form.name, tokens });
      setShowNew(false);
      load();
    } catch(e) { setError(e.message || 'Ongeldige JSON in tokens'); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: 'name',       label: 'Naam' },
    { key: 'is_default', label: 'Status', render: v => (
      <Badge label={v ? 'Actief' : 'Inactief'} variant={v ? 'success' : 'neutral'} />
    )},
    { key: '_actions', label: '', render: (_, row) => (
      !row.is_default && (
        <button
          onClick={() => activateTheme(row)}
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '4px 10px', fontSize: '12px' }}
        >
          Activeren
        </button>
      )
    )},
  ];

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Thema's</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Het actieve thema wordt platform-breed toegepast
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: 'var(--color-primary)', color: '#fff', padding: '9px 16px' }}
        >
          + Nieuw thema
        </button>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      {/* Thema preview & snelle switch */}
      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '12px', color: 'var(--color-text-muted)' }}>
          Snelle thema switch
        </div>
        <ThemeSwitcher />
      </div>

      {/* Thema tabel */}
      <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
        <Table columns={columns} rows={themes} emptyMessage="Geen thema's gevonden" />
      </div>

      {showNew && (
        <Modal title="Nieuw thema" onClose={() => setShowNew(false)} width={560}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>Naam</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '5px' }}>
              CSS tokens (JSON)
            </label>
            <textarea
              value={form.tokens}
              onChange={e => setForm(f => ({ ...f, tokens: e.target.value }))}
              rows={10}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            />
          </div>
          <ModalFooter>
            <BtnSecondary onClick={() => setShowNew(false)}>Annuleren</BtnSecondary>
            <BtnPrimary onClick={createTheme} disabled={saving}>
              {saving ? 'Opslaan...' : 'Aanmaken'}
            </BtnPrimary>
          </ModalFooter>
        </Modal>
      )}
    </AdminLayout>
  );
}
