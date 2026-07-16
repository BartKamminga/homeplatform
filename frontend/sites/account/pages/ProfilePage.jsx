import { useState, useEffect } from 'react';
import AccountLayout from '../AccountLayout.jsx';
import { api } from '@core/api.js';
import ThemeSwitcher from '@components/ThemeSwitcher.jsx';

// ── API Keys ──────────────────────────────────────────────────────────────────

function ApiKeysSection() {
  const [keys, setKeys]       = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);   // { key, name } — eenmalig tonen
  const [error, setError]     = useState('');

  useEffect(() => { load(); }, []);

  function load() {
    api.get('/api/auth/api-keys').then(setKeys).catch(e => setError(e.message));
  }

  async function create(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true); setError(''); setCreated(null);
    try {
      const result = await api.post('/api/auth/api-keys', { name: newName.trim() });
      setCreated(result);
      setNewName('');
      load();
    } catch(e) { setError(e.message); }
    finally { setCreating(false); }
  }

  async function revoke(id) {
    if (!confirm('API key intrekken?')) return;
    try {
      await api.delete(`/api/auth/api-keys/${id}`);
      setCreated(c => c?.id === id ? null : c);
      load();
    } catch(e) { setError(e.message); }
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>API Keys</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Gebruik een API key in extensies zoals de Beatport Vanger of Hockey Vanger.
      </div>

      {/* Eenmalige weergave na aanmaken */}
      {created && (
        <div style={{
          background: 'var(--color-success, #16a34a)', color: '#fff',
          borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>✓ Key aangemaakt — kopieer hem nu, hij wordt niet opnieuw getoond</div>
          <div style={{
            fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6,
            cursor: 'pointer', userSelect: 'all',
          }} onClick={() => navigator.clipboard?.writeText(created.key).then(() => {})}>
            {created.key}
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>Klik op de key om te kopiëren</div>
        </div>
      )}

      {/* Bestaande keys */}
      {keys && keys.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.map(k => (
            <div key={k.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-background)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{k.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  hp_{k.key_hint}…
                  {k.last_used_at && (
                    <span style={{ marginLeft: 8, fontFamily: 'inherit' }}>
                      · gebruikt {new Date(k.last_used_at).toLocaleDateString('nl-NL')}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => revoke(k.id)} style={{
                padding: '4px 10px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-danger, #ef4444)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Intrekken</button>
            </div>
          ))}
        </div>
      )}
      {keys && keys.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>Nog geen API keys.</div>
      )}

      {/* Nieuwe key aanmaken */}
      <form onSubmit={create} style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...input, flex: 1 }}
          placeholder="Naam, bijv. Beatport Vanger"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button type="submit" disabled={creating || !newName.trim()} style={{
          padding: '9px 16px', fontSize: 14, borderRadius: 'var(--radius-md, 8px)',
          border: 'none', background: 'var(--color-primary)', color: '#fff',
          cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1,
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          {creating ? 'Aanmaken…' : '+ Nieuwe key'}
        </button>
      </form>
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)', margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

const input = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', color: 'var(--color-text)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const label = {
  display: 'block', fontSize: 12, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  color: 'var(--color-text-muted)', marginBottom: 6,
};

const card = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '20px 24px', marginBottom: 20,
};

export default function ProfilePage() {
  const [me, setMe]   = useState(null);
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/api/auth/me').then(setMe).catch(e => setError(e.message));
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.new_password !== form.confirm)  { setError('Wachtwoorden komen niet overeen'); return; }
    if (form.new_password.length < 8)        { setError('Minimaal 8 tekens'); return; }
    setSaving(true);
    try {
      await api.patch('/api/auth/me', {
        current_password: form.current_password,
        new_password:     form.new_password,
      });
      setSuccess('Wachtwoord gewijzigd');
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <AccountLayout title="Profiel">
      {/* Account info */}
      <div style={card}>
        <Row label="Gebruikersnaam">
          <span style={{ fontSize: 16, fontWeight: 600 }}>{me?.username ?? '…'}</span>
        </Row>
        <Row label="E-mail" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{me?.email ?? '…'}</span>
        </Row>
      </div>

      {/* Thema */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Thema</div>
        <ThemeSwitcher />
      </div>

      <ApiKeysSection />

      {/* Password change */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Wachtwoord wijzigen</div>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>Huidig wachtwoord</label>
            <input type="password" style={input} value={form.current_password}
              onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
              autoComplete="current-password" />
          </div>
          <div>
            <label style={label}>Nieuw wachtwoord</label>
            <input type="password" style={input} value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
              autoComplete="new-password" />
          </div>
          <div>
            <label style={label}>Bevestig nieuw wachtwoord</label>
            <input type="password" style={input} value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              autoComplete="new-password" />
          </div>
          {error   && <p style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)', margin: 0 }}>{error}</p>}
          {success && <p style={{ fontSize: 13, color: '#22c55e', margin: 0 }}>{success}</p>}
          <button type="submit" disabled={saving} style={{
            alignSelf: 'flex-start', padding: '9px 18px', fontSize: 14, fontWeight: 500,
            borderRadius: 'var(--radius-md, 8px)', border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
          }}>
            {saving ? 'Opslaan…' : 'Wachtwoord wijzigen'}
          </button>
        </form>
      </div>
    </AccountLayout>
  );
}

function Row({ label: lbl, children, style }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 5,
      }}>
        {lbl}
      </div>
      {children}
    </div>
  );
}
