import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { setToken, loadTheme } from '@core/api.js';
import { getOidcProviders, readOidcFragment } from '@core/oidc.js';
import Logo from '@core/Logo.jsx';

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

const optional = <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>;

// Google/Microsoft is de hoofdroute (item 1332): groot en in de primaire kleur
const providerButton = {
  display: 'block', textAlign: 'center', padding: '14px', fontSize: 16, fontWeight: 600,
  borderRadius: 'var(--radius-md, 8px)', border: 'none',
  background: 'var(--color-primary)', color: '#fff', textDecoration: 'none', fontFamily: 'inherit',
};

export default function InvitePage() {
  const { token } = useParams();
  const [status,    setStatus]    = useState('checking'); // checking | valid | invalid | success
  const [message,   setMessage]   = useState('');
  const [groupName, setGroupName] = useState(null);
  const [next,      setNext]      = useState('/landing/');
  const [providers, setProviders] = useState([]);
  const [name,      setName]      = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form,      setForm]      = useState({ username: '', password: '', confirm: '', email: '' });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    // Terug van Google/Microsoft met een foutmelding (item 1271)
    const result = readOidcFragment();
    if (result.error) setError(result.error);
    getOidcProviders().then(setProviders);
    fetch(`/api/auth/invite/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.detail || 'Invalid invitation') }))
      .then(d => { setGroupName(d.group_name || null); setNext(d.next || '/landing/'); setStatus('valid'); })
      .catch(e => { setStatus('invalid'); setMessage(e.message); });
  }, [token]);

  // Naam komt van Google/Microsoft; alleen het wachtwoordpad vraagt erom
  const signupUrl = provider => `/api/auth/oidc/${provider}/signup?invite=${encodeURIComponent(token)}`;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.username.trim())             { setError('Username is required'); return; }
    if (form.password.length < 8)         { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirm)   { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/auth/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:     form.username.trim(),
          password:     form.password,
          email:        form.email.trim() || undefined,
          display_name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Sign-up failed');
      setToken(data.access_token);
      localStorage.setItem('hp_user', JSON.stringify({ id: data.user_id, username: data.username }));
      setStatus('success');
      setTimeout(() => { window.location.href = next; }, 1500);
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
        <div style={{ marginBottom: '1.5rem' }}>
          <Logo size={32} showName nameStyle={{ fontSize: 17, color: 'var(--color-text)' }} />
        </div>

        {status === 'checking' && (
          <p style={{ color: 'var(--color-text-muted)' }}>Checking invitation…</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Invalid invitation</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
            <a href="/landing/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>← Back to home</a>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Welcome!</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Account created. Redirecting…</p>
          </>
        )}

        {status === 'valid' && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.5px' }}>
              {groupName ? <>Join {groupName}</> : 'Create your account'}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
              You have been invited to WebHeaven{groupName ? <> — group <strong style={{ color: 'var(--color-text)' }}>{groupName}</strong></> : ''}.
              {providers.length > 0 && ' One click with your existing account, no new password needed.'}
            </p>

            {providers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {providers.map(p => (
                  <a key={p.id} href={signupUrl(p.id)} style={providerButton}>Continue with {p.label}</a>
                ))}
              </div>
            )}

            {error && <p style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)', margin: '0 0 16px' }}>{error}</p>}

            {providers.length > 0 && !showPassword ? (
              <button onClick={() => setShowPassword(true)} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: 13, textDecoration: 'underline', fontFamily: 'inherit',
              }}>
                Use a username and password instead
              </button>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Name {optional}</label>
                  <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
                    placeholder="How others see you" autoComplete="name" />
                </div>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input style={inputStyle} value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="username" />
                </div>
                <div>
                  <label style={labelStyle}>Email {optional}</label>
                  <input type="email" style={inputStyle} value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoComplete="email" />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" style={inputStyle} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password" />
                </div>
                <div>
                  <label style={labelStyle}>Confirm password</label>
                  <input type="password" style={inputStyle} value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    autoComplete="new-password" />
                </div>
                <button type="submit" disabled={saving} style={{
                  padding: '11px', fontSize: 14, fontWeight: 500,
                  borderRadius: 'var(--radius-md, 8px)', border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}>
                  {saving ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
