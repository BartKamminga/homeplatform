import { useEffect, useState } from 'react'

export default function Landing() {
  const [sites, setSites]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/sites')
      .then(r => r.json())
      .then(data => { setSites(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-base)',
    }}>
      <div style={{ width: '100%', maxWidth: '560px', padding: '40px 24px' }}>

        <div style={{
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '2rem',
        }}>
          Homeplatform
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: '6px',
        }}>
          Welkom
        </h1>
        <p style={{
          fontSize: '15px',
          color: 'var(--color-text-muted)',
          marginBottom: '2rem',
        }}>
          Kies een applicatie om te starten
        </p>

        {loading && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Laden...</p>
        )}
        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{error}</p>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '2rem',
        }}>
          {sites.map(site => (
            <a
              key={site.slug}
              href={`/${site.slug}/`}
              style={{
                background: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 16px',
                textDecoration: 'none',
                display: 'block',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                marginBottom: '12px',
              }}>
                {site.icon || '◈'}
              </div>

              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: '4px',
              }}>
                {site.name}
              </div>

              <div style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                /{site.slug}
              </div>
            </a>
          ))}
        </div>

        <a
          href="/admin/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '7px 14px',
            textDecoration: 'none',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--color-text)'
            e.currentTarget.style.borderColor = 'var(--color-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--color-text-muted)'
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }}
        >
          ⚙ Beheer
        </a>
      </div>
    </div>
  )
}
