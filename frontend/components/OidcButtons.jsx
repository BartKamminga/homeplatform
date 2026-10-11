import { useEffect, useState } from 'react'
import { getOidcProviders, oidcLoginUrl } from '@core/oidc.js'

// Knoppen "Sign in with Google/Microsoft" (item 1271) - alleen de providers
// die op deze omgeving geconfigureerd zijn. next = waar je na het inloggen
// terugkomt (relatief pad).
export default function OidcButtons({ next }) {
  const [providers, setProviders] = useState([])

  useEffect(() => { getOidcProviders().then(setProviders) }, [])

  if (!providers.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted, var(--muted, #888))' }}>or</div>
      {providers.map(p => (
        <a key={p.id} href={oidcLoginUrl(p.id, next)} style={buttonStyle}>
          Sign in with {p.label}
        </a>
      ))}
    </div>
  )
}

const buttonStyle = {
  display: 'block', textAlign: 'center', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border, var(--border, #333))',
  color: 'var(--color-text, var(--text, #fff))', background: 'transparent',
  fontSize: 14, fontWeight: 500, textDecoration: 'none',
  fontFamily: 'var(--font-body, inherit)',
}
