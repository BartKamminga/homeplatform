import { NavLink } from 'react-router-dom';
import { api, clearToken } from '@core/api.js';
import Logo from '@core/Logo.jsx';

const APP_LABELS = {
  '/dontforget/': 'DontForget',
  '/mixmusic/':   'Mix Music',
  '/tournix/':    'Tournix',
  '/fiets/':      'FietsPrognose',
  '/nkhockey/':   'NK Hockey',
}

const navLink = ({ isActive }) => ({
  textDecoration: 'none', fontSize: 14, fontWeight: 500,
  padding: '4px 0', marginRight: 28,
  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
  transition: 'color 0.15s',
});

export default function AccountLayout({ title, children }) {
  const backUrl = new URLSearchParams(window.location.search).get('back')
  const backLabel = backUrl ? (APP_LABELS[backUrl] ?? 'App') : null

  async function handleLogout() {
    try { await api.post('/api/auth/logout'); } catch {}
    clearToken();
    window.location.href = '/landing/';
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)', color: 'var(--color-text)' }}>
      <header style={{
        padding: '0 24px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', height: 54, gap: 4,
      }}>
        {backLabel ? (
          <a href={backUrl} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginRight: 28, color: 'var(--color-text-muted)', fontSize: 13 }}>
            <span>←</span>
            <span>{backLabel}</span>
          </a>
        ) : (
          <a href="/landing/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>←</span>
            <Logo size={22} showName nameStyle={{ fontSize: 13, color: 'var(--color-text)' }} />
          </a>
        )}
        <NavLink to="/account/profile"    style={navLink}>Profiel</NavLink>
        <NavLink to="/account/groups"     style={navLink}>Groepen</NavLink>
        <NavLink to="/account/changelog"  style={navLink}>Changelog</NavLink>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleLogout}
            style={{
              fontSize: 13, color: 'var(--color-text-muted)', background: 'none',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md, 8px)',
              padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Uitloggen
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
        {title && (
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 28, color: 'var(--color-text)' }}>
            {title}
          </h1>
        )}
        {children}
      </main>
    </div>
  );
}
