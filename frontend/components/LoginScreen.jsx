import { useState } from 'react'
import { login } from '@core/api.js'
import ThemeSwitcher from './ThemeSwitcher.jsx'

export default function LoginScreen({ siteName = 'HomePlatform', onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await login(username, password)
      onLogin()
    } catch (e) {
      setError(e.message || 'Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg, #0a0a0f)',
    }}>
      <div style={{
        width: 320, padding: '32px 28px',
        background: 'var(--bg2, #111118)',
        border: '1px solid var(--border, #222)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
          <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 20, fontWeight: 700, color: 'var(--text, #fff)' }}>
            {siteName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted, #666)', marginTop: 4 }}>Log in om verder te gaan</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Gebruikersnaam" autoFocus required
            style={inputStyle}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Wachtwoord" required
            style={inputStyle}
          />
          {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            padding: '10px', borderRadius: 8, border: 'none',
            background: 'var(--accent, #6366f1)', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
            fontFamily: 'var(--font-body, sans-serif)',
          }}>
            {loading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <ThemeSwitcher compact />
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #222)',
  background: 'var(--bg3, #1a1a22)', color: 'var(--text, #fff)', fontSize: 13,
  fontFamily: 'var(--font-body, sans-serif)', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
