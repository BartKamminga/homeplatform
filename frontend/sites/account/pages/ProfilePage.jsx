import { useState, useEffect } from 'react';
import AccountLayout from '../AccountLayout.jsx';
import { api } from '@core/api.js';

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
