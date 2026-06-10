import { useState, useEffect } from 'react'
import { isTokenValid, api } from '@core/api.js'
import LoginScreen from './LoginScreen.jsx'

function NoAccess({ siteName }) {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg, #0a0a0f)',
    }}>
      <div style={{
        textAlign: 'center', padding: '40px 32px',
        background: 'var(--bg2, #111118)',
        border: '1px solid var(--border, #222)',
        borderRadius: 14, maxWidth: 320,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #fff)', marginBottom: 8 }}>
          Geen toegang
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted, #666)', lineHeight: 1.5 }}>
          Je hebt geen toegang tot <strong style={{ color: 'var(--text, #fff)' }}>{siteName}</strong>.
          Neem contact op met de beheerder.
        </div>
        <button
          onClick={() => { localStorage.removeItem('hp_token'); localStorage.removeItem('hp_user'); window.location.reload() }}
          style={{
            marginTop: 20, padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border, #222)',
            background: 'var(--bg3, #1a1a22)', color: 'var(--muted, #666)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--font-body, sans-serif)',
          }}
        >
          Ander account
        </button>
      </div>
    </div>
  )
}

export default function AuthGate({ site, siteName, children }) {
  const [authed, setAuthed] = useState(isTokenValid())
  const [access, setAccess] = useState(null) // null=laden, true=ok, false=geen toegang

  useEffect(() => {
    if (!authed) { setAccess(null); return }
    api.get('/api/auth/me/sites')
      .then(data => setAccess(data.sites.includes(site)))
      .catch(() => setAccess(false))
  }, [authed, site])

  if (!authed) {
    return <LoginScreen siteName={siteName} onLogin={() => setAuthed(true)} />
  }

  if (access === null) return null

  if (!access) {
    return <NoAccess siteName={siteName} />
  }

  return children
}
