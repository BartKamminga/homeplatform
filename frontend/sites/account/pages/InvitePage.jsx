import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { setToken, loadTheme } from '@core/api.js';

loadTheme();

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', color: 'var(--color-text)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  color: 'var(--color-text-muted)', marginBottom: 6,
};

export default function InvitePage() {
  const { token } = useParams();
  const [status,    setStatus]    = useState('checking'); // checking | valid | invalid | success
  const [message,   setMessage]   = useState('');
  const [groupName, setGroupName] = useState(null);
  const [form,      setForm]      = useState({ username: '', password: '', confirm: '', email: '' });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    fetch(`/api/auth/invite/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.detail || 'Ongeldig') }))
      .then(d => { setGroupName(d.group_name || null); setStatus('valid'); })
      .catch(e => { setStatus('invalid'); setMessage(e.message); });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.username.trim())             { setError('Gebruikersnaam is verplicht'); return; }
    if (form.password.length < 8)         { setError('Wachtwoord minimaal 8 tekens'); return; }
    if (form.password !== form.confirm)   { setError('Wachtwoorden komen niet overeen'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/auth/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          email:    form.email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Aanmelden mislukt');
      setToken(data.access_token);
      localStorage.setItem('hp_user', JSON.stringify({ id: data.user_id, username: data.username }));
      setStatus('success');
      setTimeout(() => { window.location.href = '/landing/'; }, 1500);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const wrap = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-background, #fff)',
    fontFamily: 'var(--font-body, Inter, sans-serif)',
    color: 'var(--color-text, #111)',
  };

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 440, padding: '48px 24px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          Homeplatform
        </div>

        {status === 'checking' && (
          <p style={{ color: 'var(--color-text-muted)' }}>Uitnodiging controleren…</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Uitnodiging ongeldig</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
            <a href="/landing/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>← Terug naar home</a>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Welkom!</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Account aangemaakt. Je wordt doorgestuurd…</p>
          </>
        )}

        {status === 'valid' && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.5px' }}>
              Account aanmaken
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
              Je bent uitgenodigd voor Homeplatform{groupName ? <> — groep <strong style={{ color: 'var(--color-text)' }}>{groupName}</strong></> : ''}.
              Kies een gebruikersnaam en wachtwoord.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Gebruikersnaam</label>
                <input style={inputStyle} value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoFocus autoComplete="username" />
              </div>
              <div>
                <label style={labelStyle}>
                  E-mail{' '}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optioneel)</span>
                </label>
                <input type="email" style={inputStyle} value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  autoComplete="email" />
              </div>
              <div>
                <label style={labelStyle}>Wachtwoord</label>
                <input type="password" style={inputStyle} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password" />
              </div>
              <div>
                <label style={labelStyle}>Bevestig wachtwoord</label>
                <input type="password" style={inputStyle} value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  autoComplete="new-password" />
              </div>
              {error && (
                <p style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)', margin: 0 }}>{error}</p>
              )}
              <button type="submit" disabled={saving} style={{
                padding: '11px', fontSize: 14, fontWeight: 500,
                borderRadius: 'var(--radius-md, 8px)', border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                fontFamily: 'inherit',
              }}>
                {saving ? 'Account aanmaken…' : 'Account aanmaken'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
