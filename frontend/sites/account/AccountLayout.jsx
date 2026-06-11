import { NavLink } from 'react-router-dom';
import { api, clearToken } from '@core/api.js';

const navLink = ({ isActive }) => ({
  textDecoration: 'none', fontSize: 14, fontWeight: 500,
  padding: '4px 0', marginRight: 28,
  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
  transition: 'color 0.15s',
});

export default function AccountLayout({ title, children }) {
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
        <a href="/landing/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, marginRight: 28, color: 'var(--color-text-muted)', fontSize: 13 }}>
          ←
          <span style={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>
            Homeplatform
          </span>
        </a>
        <NavLink to="/account/profile" style={navLink}>Profiel</NavLink>
        <NavLink to="/account/groups"  style={navLink}>Groepen</NavLink>
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
